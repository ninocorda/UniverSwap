// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenVesting is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        address token;
        address funder;
        address beneficiary;
        uint256 amount;
        uint256 released;
        uint64 releaseTime;
    }

    struct VestingRequest {
        address beneficiary;
        uint256 amount;
        uint64 releaseTime;
    }

    uint256 public vestingCount;
    mapping(uint256 => VestingSchedule) public vestings;
    mapping(address => uint256[]) private _vestingsByBeneficiary;
    mapping(address => uint256[]) private _vestingsByFunder;

    event VestingCreated(
        uint256 indexed vestingId,
        address indexed token,
        address indexed beneficiary,
        address funder,
        uint256 amount,
        uint64 releaseTime
    );
    event VestingReleased(uint256 indexed vestingId, address indexed token, address indexed beneficiary, uint256 amount);

    function createVestingBatch(address token, VestingRequest[] calldata requests) external nonReentrant returns (uint256 firstId, uint256 count) {
        require(token != address(0), "TOKEN_ZERO");
        uint256 totalAmount;
        count = requests.length;
        require(count > 0, "EMPTY_BATCH");

        for (uint256 i = 0; i < count; i++) {
            VestingRequest calldata item = requests[i];
            require(item.beneficiary != address(0), "BENEFICIARY_ZERO");
            require(item.amount > 0, "AMOUNT_ZERO");
            require(item.releaseTime > block.timestamp, "RELEASE_PAST");
            totalAmount += item.amount;
        }

        IERC20(token).safeTransferFrom(msg.sender, address(this), totalAmount);

        firstId = vestingCount + 1;
        for (uint256 i = 0; i < count; i++) {
            VestingRequest calldata item = requests[i];
            uint256 vestingId = ++vestingCount;
            vestings[vestingId] = VestingSchedule({
                token: token,
                funder: msg.sender,
                beneficiary: item.beneficiary,
                amount: item.amount,
                released: 0,
                releaseTime: item.releaseTime
            });
            _vestingsByBeneficiary[item.beneficiary].push(vestingId);
            _vestingsByFunder[msg.sender].push(vestingId);
            emit VestingCreated(vestingId, token, item.beneficiary, msg.sender, item.amount, item.releaseTime);
        }
    }

    function release(uint256 vestingId) public nonReentrant {
        VestingSchedule storage schedule = vestings[vestingId];
        require(schedule.beneficiary != address(0), "UNKNOWN_VESTING");
        require(block.timestamp >= schedule.releaseTime, "NOT_RELEASED");
        uint256 unreleased = schedule.amount - schedule.released;
        require(unreleased > 0, "NOTHING_TO_RELEASE");
        schedule.released = schedule.amount;
        IERC20(schedule.token).safeTransfer(schedule.beneficiary, unreleased);
        emit VestingReleased(vestingId, schedule.token, schedule.beneficiary, unreleased);
    }

    function releaseMany(uint256[] calldata vestingIds) external {
        for (uint256 i = 0; i < vestingIds.length; i++) {
            release(vestingIds[i]);
        }
    }

    function pendingAmount(uint256 vestingId) external view returns (uint256) {
        VestingSchedule memory schedule = vestings[vestingId];
        if (schedule.beneficiary == address(0) || block.timestamp < schedule.releaseTime) {
            return 0;
        }
        return schedule.amount - schedule.released;
    }

    function getVestingsByBeneficiary(address beneficiary) external view returns (uint256[] memory) {
        return _vestingsByBeneficiary[beneficiary];
    }

    function getVestingsByFunder(address funder) external view returns (uint256[] memory) {
        return _vestingsByFunder[funder];
    }
}
