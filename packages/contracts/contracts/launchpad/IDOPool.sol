// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title IDOPool - In-house Polkastarter-like IDO pool
/// @notice Supports whitelist, caps, schedules, ETH or ERC20 raise, claims/refunds, and owner finalization
contract IDOPool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Status { Pending, Active, FinalizedSuccess, FinalizedFail }

    // Sale params
    address public immutable saleToken;        // Token being sold
    address public immutable raiseToken;       // Token used to raise (address(0) for ETH)
    address public immutable fundsRecipient;   // Where raised funds go on success

    uint256 public immutable startTime;        // unix
    uint256 public immutable endTime;          // unix

    uint256 public immutable softCap;          // minimal raise to succeed
    uint256 public immutable hardCap;          // maximum raise

    uint256 public immutable minContribution;  // per-user
    uint256 public immutable maxContribution;  // per-user

    // Pricing: amount of saleToken per 1e18 unit of raise token
    uint256 public immutable tokensPerUnit;    // scaled by 1e18 (unit = 1e18 of raise token)

    // State
    uint256 public totalRaised;
    bool public whitelistEnabled;
    mapping(address => bool) public whitelist;
    mapping(address => uint256) public contributions;
    mapping(address => bool) public claimed;

    Status public status;

    event Contributed(address indexed user, uint256 amount);
    event WhitelistSet(address indexed user, bool allowed);
    event Finalized(bool success, uint256 totalRaised);
    event Claimed(address indexed user, uint256 saleAmount);
    event Refunded(address indexed user, uint256 raiseAmount);

    modifier onlyDuringSale() {
        require(block.timestamp >= startTime && block.timestamp < endTime, "SALE_CLOSED");
        require(status == Status.Active || status == Status.Pending, "NOT_ACTIVE");
        _;
    }

    modifier onlyAfterSale() {
        require(block.timestamp >= endTime || status == Status.FinalizedSuccess || status == Status.FinalizedFail, "NOT_ENDED");
        _;
    }

    constructor(
        address _owner,
        address _saleToken,
        address _raiseToken,
        address _fundsRecipient,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _minContribution,
        uint256 _maxContribution,
        uint256 _tokensPerUnit,
        bool _whitelistEnabled
    ) Ownable(_owner) {
        require(_saleToken != address(0), "SALE_ZERO");
        require(_fundsRecipient != address(0), "RECIP_ZERO");
        require(_startTime < _endTime, "TIME_INV");
        require(_softCap <= _hardCap, "CAPS_INV");
        require(_tokensPerUnit > 0, "PRICE_ZERO");
        require(_maxContribution == 0 || _maxContribution >= _minContribution, "LIMITS_INV");

        saleToken = _saleToken;
        raiseToken = _raiseToken;
        fundsRecipient = _fundsRecipient;
        startTime = _startTime;
        endTime = _endTime;
        softCap = _softCap;
        hardCap = _hardCap;
        minContribution = _minContribution;
        maxContribution = _maxContribution;
        tokensPerUnit = _tokensPerUnit;
        whitelistEnabled = _whitelistEnabled;

        status = Status.Pending;
    }

    function setWhitelist(address user, bool allowed) external onlyOwner {
        whitelist[user] = allowed;
        emit WhitelistSet(user, allowed);
    }

    function setWhitelistBatch(address[] calldata users, bool allowed) external onlyOwner {
        for (uint256 i = 0; i < users.length; i++) {
            whitelist[users[i]] = allowed;
            emit WhitelistSet(users[i], allowed);
        }
    }

    function contribute(uint256 amount) external payable nonReentrant onlyDuringSale {
        if (status == Status.Pending) status = Status.Active;
        if (whitelistEnabled) {
            require(whitelist[msg.sender], "NOT_WHITELISTED");
        }

        if (raiseToken == address(0)) {
            // ETH raise
            require(msg.value > 0, "NO_ETH");
            amount = msg.value;
        } else {
            // ERC20 raise
            require(msg.value == 0, "ETH_NOT_ALLOWED");
            require(amount > 0, "AMOUNT_ZERO");
            IERC20(raiseToken).safeTransferFrom(msg.sender, address(this), amount);
        }

        require(totalRaised + amount <= hardCap, "HARD_CAP");
        uint256 userNew = contributions[msg.sender] + amount;
        require(maxContribution == 0 || userNew <= maxContribution, "MAX_USER");
        require(userNew >= minContribution, "MIN_USER");

        contributions[msg.sender] = userNew;
        totalRaised += amount;

        emit Contributed(msg.sender, amount);
    }

    function finalize() external onlyOwner onlyAfterSale {
        require(status == Status.Active || status == Status.Pending, "ALREADY_FINAL");
        if (totalRaised >= softCap) {
            status = Status.FinalizedSuccess;
            // Forward funds to recipient
            if (raiseToken == address(0)) {
                (bool ok, ) = payable(fundsRecipient).call{value: address(this).balance}("");
                require(ok, "FWD_FAIL");
            } else {
                IERC20(raiseToken).safeTransfer(fundsRecipient, IERC20(raiseToken).balanceOf(address(this)));
            }
        } else {
            status = Status.FinalizedFail;
        }
        emit Finalized(status == Status.FinalizedSuccess, totalRaised);
    }

    function claim() external nonReentrant onlyAfterSale {
        require(status == Status.FinalizedSuccess, "NOT_SUCCESS");
        require(!claimed[msg.sender], "CLAIMED");
        uint256 contributed = contributions[msg.sender];
        require(contributed > 0, "NO_CONTRIB");
        claimed[msg.sender] = true;

        // sale amount = contributed * tokensPerUnit / 1e18
        uint256 saleAmt = (contributed * tokensPerUnit) / 1e18;
        IERC20(saleToken).safeTransfer(msg.sender, saleAmt);
        emit Claimed(msg.sender, saleAmt);
    }

    function refund() external nonReentrant onlyAfterSale {
        require(status == Status.FinalizedFail, "NOT_FAIL");
        uint256 amount = contributions[msg.sender];
        require(amount > 0, "NO_CONTRIB");
        contributions[msg.sender] = 0; // prevent re-entrancy double spend
        if (raiseToken == address(0)) {
            (bool ok, ) = payable(msg.sender).call{value: amount}("");
            require(ok, "REFUND_FAIL");
        } else {
            IERC20(raiseToken).safeTransfer(msg.sender, amount);
        }
        emit Refunded(msg.sender, amount);
    }

    // Owner can deposit sale tokens prior to claim
    function depositSaleTokens(uint256 amount) external onlyOwner {
        IERC20(saleToken).safeTransferFrom(msg.sender, address(this), amount);
    }

    // View helper: estimate sale amount for a contribution amount
    function previewSaleAmount(uint256 raiseAmount) external view returns (uint256) {
        return (raiseAmount * tokensPerUnit) / 1e18;
    }

    receive() external payable {}
}
