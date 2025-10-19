// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title FeeManager
 * @notice Splits protocol fees: 50% buyback + add liquidity, 50% team treasury.
 * @dev Skeleton; integration points with DEX/treasury to be wired later.
 */
contract FeeManager {
    address public immutable treasury;
    address public owner;

    event OwnershipTransferred(address indexed prev, address indexed next);
    event FeesProcessed(uint256 amount, uint256 buybackPortion, uint256 treasuryPortion);

    modifier onlyOwner() {
        require(msg.sender == owner, 'NOT_OWNER');
        _;
    }

    constructor(address _treasury) {
        require(_treasury != address(0), 'TREASURY_ZERO');
        treasury = _treasury;
        owner = msg.sender;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), 'OWNER_ZERO');
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Accept ETH protocol fees and split according to tokenomics.
    receive() external payable {
        _process(msg.value);
    }

    function process() external payable {
        _process(msg.value);
    }

    function _process(uint256 amount) internal {
        if (amount == 0) return;
        uint256 buyback = amount / 2;
        uint256 toTreasury = amount - buyback;

        // TODO: implement buyback + add liquidity using a DEX router once integrated.
        // For now, forward treasury share.
        (bool ok, ) = payable(treasury).call{value: toTreasury}("");
        require(ok, 'TREASURY_SEND_FAIL');

        emit FeesProcessed(amount, buyback, toTreasury);
    }
}
