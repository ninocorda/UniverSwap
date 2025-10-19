// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IUniswapV2RouterLike} from "./interfaces/IUniswapV2RouterLike.sol";

contract AggregatorRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Hop {
        address router;
        address[] path;
    }

    struct SwapExactParams {
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minAmountOut;
        address recipient;
        uint256 deadline;
        Hop[] hops;
    }

    struct QuoteResult {
        uint256 amountOut;
        uint256 midPrice; // scaled by 1e18
    }

    mapping(address => bool) public isRouterAllowed;

    event RouterPermissionUpdated(address indexed router, bool allowed);
    event SwapExecuted(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );

    constructor(address owner_, address[] memory allowedRouters) Ownable(owner_) {
        for (uint256 i = 0; i < allowedRouters.length; i++) {
            _setRouterPermission(allowedRouters[i], true);
        }
    }

    function setRouterPermission(address router, bool allowed) external onlyOwner {
        _setRouterPermission(router, allowed);
    }

    function quote(Hop[] calldata hops, uint256 amountIn) external view returns (QuoteResult memory) {
        require(amountIn > 0, "amountIn=0");
        require(hops.length > 0, "no hops");

        uint256 currentAmount = amountIn;
        address currentToken;

        for (uint256 i = 0; i < hops.length; i++) {
            Hop calldata hop = hops[i];
            require(isRouterAllowed[hop.router], "router not allowed");
            require(hop.path.length >= 2, "invalid path");
            if (i == 0) {
                currentToken = hop.path[0];
            } else {
                require(hop.path[0] == currentToken, "path mismatch");
            }

            uint256[] memory amounts = IUniswapV2RouterLike(hop.router).getAmountsOut(currentAmount, hop.path);
            require(amounts.length == hop.path.length, "invalid amounts");
            currentAmount = amounts[amounts.length - 1];
            currentToken = hop.path[hop.path.length - 1];
        }

        require(currentAmount > 0, "zero quote");
        uint256 midPrice = (currentAmount * 1e18) / amountIn;
        return QuoteResult({amountOut: currentAmount, midPrice: midPrice});
    }

    function swapExactTokensForTokensOnChain(SwapExactParams calldata params) external nonReentrant returns (uint256) {
        require(params.amountIn > 0, "amountIn=0");
        require(params.minAmountOut > 0, "minAmountOut=0");
        require(params.recipient != address(0), "recipient=0");
        require(params.deadline >= block.timestamp, "expired");
        require(params.hops.length > 0, "no hops");

        IERC20(params.tokenIn).safeTransferFrom(msg.sender, address(this), params.amountIn);

        uint256 currentAmount = params.amountIn;
        address currentToken = params.tokenIn;

        for (uint256 i = 0; i < params.hops.length; i++) {
            Hop calldata hop = params.hops[i];
            require(isRouterAllowed[hop.router], "router not allowed");
            require(hop.path.length >= 2, "invalid path");
            require(hop.path[0] == currentToken, "path mismatch");

            address outputToken = hop.path[hop.path.length - 1];
            address recipient = i == params.hops.length - 1 ? params.recipient : address(this);

            _approveIfNeeded(currentToken, hop.router, currentAmount);

            uint256[] memory amounts = IUniswapV2RouterLike(hop.router).swapExactTokensForTokens(
                currentAmount,
                0,
                hop.path,
                recipient,
                params.deadline
            );
            require(amounts.length == hop.path.length, "invalid swap amounts");

            currentAmount = amounts[amounts.length - 1];
            currentToken = outputToken;
        }

        require(currentToken == params.tokenOut, "bad final token");
        require(currentAmount >= params.minAmountOut, "slippage");

        emit SwapExecuted(msg.sender, params.tokenIn, params.tokenOut, params.amountIn, currentAmount, params.recipient);
        return currentAmount;
    }

    function _setRouterPermission(address router, bool allowed) internal {
        require(router != address(0), "router=0");
        isRouterAllowed[router] = allowed;
        emit RouterPermissionUpdated(router, allowed);
    }

    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        uint256 currentAllowance = IERC20(token).allowance(address(this), spender);
        if (currentAllowance < amount) {
            SafeERC20.forceApprove(IERC20(token), spender, amount);
        }
    }
}
