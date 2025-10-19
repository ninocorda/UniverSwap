// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IUniswapV3Adapter {
    /// @notice Swap exact tokens via Uniswap V3 using the official ISwapRouter
    /// @param tokenIn Input token
    /// @param tokenOut Output token
    /// @param fee Fee tier (e.g., 500, 3000, 10000)
    /// @param recipient Receiver of tokenOut
    /// @param amountIn Exact input amount
    /// @param amountOutMinimum Minimum output amount with slippage protection
    /// @return amountOut Received output amount
    function swapExactInV3(
        address tokenIn,
        address tokenOut,
        uint24 fee,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut);
}

interface IUniswapV2Adapter {
    /// @notice Swap exact tokens via a Uniswap V2-like router (Sushi/Pancake)
    /// @param router Address of the V2 router
    /// @param path Swap path
    /// @param recipient Receiver of tokenOut
    /// @param amountIn Exact input amount
    /// @param amountOutMinimum Min output
    /// @return amountOut Final amount out
    function swapExactInV2(
        address router,
        address[] calldata path,
        address recipient,
        uint256 amountIn,
        uint256 amountOutMinimum
    ) external returns (uint256 amountOut);
}
