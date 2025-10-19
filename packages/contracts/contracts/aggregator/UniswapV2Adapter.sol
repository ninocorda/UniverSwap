// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IUniswapV2Adapter} from "./IAdapters.sol";
import {IUniswapV2Router} from "./interfaces/IUniswapV2Router.sol";

contract UniswapV2Adapter is IUniswapV2Adapter {
    using SafeERC20 for IERC20;

    function swapExactInV2(
        address router,
        address[] calldata path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external override returns (uint256 amountOut) {
        // Adapter expects tokens already sent to this contract
        IERC20(path[0]).forceApprove(router, 0);
        IERC20(path[0]).forceApprove(router, amountIn);
        uint256[] memory amounts = IUniswapV2Router(router).swapExactTokensForTokens(
            amountIn,
            amountOutMinimum,
            path,
            recipient,
            block.timestamp
        );
        amountOut = amounts[amounts.length - 1];
    }
}
