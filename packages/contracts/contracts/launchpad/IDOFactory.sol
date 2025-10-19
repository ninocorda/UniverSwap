// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IDOPool} from "./IDOPool.sol";

/// @title IDOFactory - creates IDOPool instances
contract IDOFactory {
    event PoolCreated(address indexed creator, address indexed pool, address saleToken, address raiseToken);

    address[] public allPools;
    mapping(address => bool) public isPool;

    function createPool(
        address owner,
        address saleToken,
        address raiseToken,
        address fundsRecipient,
        uint256 startTime,
        uint256 endTime,
        uint256 softCap,
        uint256 hardCap,
        uint256 minContribution,
        uint256 maxContribution,
        uint256 tokensPerUnit,
        bool whitelistEnabled
    ) external returns (address pool) {
        IDOPool p = new IDOPool(
            owner,
            saleToken,
            raiseToken,
            fundsRecipient,
            startTime,
            endTime,
            softCap,
            hardCap,
            minContribution,
            maxContribution,
            tokensPerUnit,
            whitelistEnabled
        );
        pool = address(p);
        allPools.push(pool);
        isPool[pool] = true;
        emit PoolCreated(msg.sender, pool, saleToken, raiseToken);
    }

    function getAllPools() external view returns (address[] memory) {
        return allPools;
    }
}
