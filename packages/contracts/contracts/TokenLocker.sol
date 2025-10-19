// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TokenLocker is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct LockInfo {
        address token;
        address owner;
        uint256 amount;
        uint64 unlockTime;
        bool withdrawn;
    }

    uint256 public lockCount;
    mapping(uint256 => LockInfo) public locks;
    mapping(address => uint256[]) private _locksByOwner;

    event TokensLocked(uint256 indexed lockId, address indexed token, address indexed owner, uint256 amount, uint64 unlockTime);
    event TokensWithdrawn(uint256 indexed lockId, address indexed token, address indexed owner, uint256 amount);

    function lock(address token, uint256 amount, uint64 unlockTime) external nonReentrant returns (uint256 lockId) {
        require(token != address(0), "TOKEN_ZERO");
        require(amount > 0, "AMOUNT_ZERO");
        require(unlockTime > block.timestamp, "UNLOCK_PAST");

        lockId = ++lockCount;
        locks[lockId] = LockInfo({
            token: token,
            owner: msg.sender,
            amount: amount,
            unlockTime: unlockTime,
            withdrawn: false
        });
        _locksByOwner[msg.sender].push(lockId);

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit TokensLocked(lockId, token, msg.sender, amount, unlockTime);
    }

    function withdraw(uint256 lockId) external nonReentrant {
        LockInfo storage info = locks[lockId];
        require(info.owner == msg.sender, "NOT_OWNER");
        require(!info.withdrawn, "ALREADY_WITHDRAWN");
        require(block.timestamp >= info.unlockTime, "NOT_UNLOCKED");

        info.withdrawn = true;
        IERC20(info.token).safeTransfer(msg.sender, info.amount);
        emit TokensWithdrawn(lockId, info.token, msg.sender, info.amount);
    }

    function getLocksByOwner(address owner) external view returns (uint256[] memory) {
        return _locksByOwner[owner];
    }
}
