// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV3Adapter, IUniswapV2Adapter} from "./IAdapters.sol";

interface IWETH {
    function deposit() external payable;
}

/// @title AggregatorRouter
/// @notice Routes swaps through external DEX adapters and takes a platform fee to treasury
/// @dev MVP supports ERC20->ERC20 swaps. ETH/WETH handling can be added next.
contract AggregatorRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // fee in basis points (1e4 = 100%). Default 20 (0.2%)
    uint16 public feeBps = 20;
    address public treasury;

    IUniswapV3Adapter public uniswapV3Adapter;
    IUniswapV2Adapter public uniswapV2Adapter;
    address public immutable WETH; // WETH/WBNB per chain

    event FeeUpdated(uint16 feeBps);
    event TreasuryUpdated(address treasury);
    event AdaptersUpdated(address v3, address v2);
    event SwapExecuted(address indexed sender, address tokenIn, address tokenOut, uint256 amountIn, uint256 amountOut, string route);

    constructor(address _owner, address _treasury, address _weth) Ownable(_owner) {
        require(_treasury != address(0), "TREASURY_ZERO");
        require(_weth != address(0), "WETH_ZERO");
        treasury = _treasury;
        WETH = _weth;
    }

    // Admin
    function setFeeBps(uint16 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "FEE_TOO_HIGH"); // max 10%
        feeBps = _feeBps;
        emit FeeUpdated(_feeBps);
    }

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "TREASURY_ZERO");
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    function setAdapters(address v3, address v2) external onlyOwner {
        uniswapV3Adapter = IUniswapV3Adapter(v3);
        uniswapV2Adapter = IUniswapV2Adapter(v2);
        emit AdaptersUpdated(v3, v2);
    }

    // Internal fee calculation
    function _takeFee(address token, uint256 amount) internal returns (uint256 net, uint256 fee) {
        fee = (amount * feeBps) / 10_000;
        net = amount - fee;
        if (fee > 0) {
            IERC20(token).safeTransfer(treasury, fee);
        }
    }

    // Route via Uniswap V3
    function swapExactInViaV3(
        address tokenIn,
        address tokenOut,
        uint24 feeTier,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        require(address(uniswapV3Adapter) != address(0), "V3_ADAPTER_ZERO");
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        (uint256 net, ) = _takeFee(tokenIn, amountIn);

        // Send net to adapter
        IERC20(tokenIn).safeTransfer(address(uniswapV3Adapter), net);

        amountOut = uniswapV3Adapter.swapExactInV3(tokenIn, tokenOut, feeTier, recipient, net, amountOutMin);
        emit SwapExecuted(msg.sender, tokenIn, tokenOut, amountIn, amountOut, "UniswapV3");
    }

    // Route via a V2 router (Sushi/Pancake/UniV2)
    function swapExactInViaV2(
        address router,
        address[] calldata path,
        uint256 amountIn,
        uint256 amountOutMin,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        require(address(uniswapV2Adapter) != address(0), "V2_ADAPTER_ZERO");
        address tokenIn = path[0];
        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        (uint256 net, ) = _takeFee(tokenIn, amountIn);
        IERC20(tokenIn).safeTransfer(address(uniswapV2Adapter), net);
        amountOut = uniswapV2Adapter.swapExactInV2(router, path, recipient, net, amountOutMin);
        emit SwapExecuted(msg.sender, tokenIn, path[path.length - 1], amountIn, amountOut, "UniswapV2Like");
    }

    // Native -> ERC20 via V3: wraps native to WETH, takes fee, routes
    function swapExactNativeInViaV3(
        address tokenOut,
        uint24 feeTier,
        uint256 amountOutMin,
        address recipient
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(address(uniswapV3Adapter) != address(0), "V3_ADAPTER_ZERO");
        require(msg.value > 0, "ZERO_MSG_VALUE");
        // Wrap to WETH
        IWETH(WETH).deposit{value: msg.value}();
        (uint256 net, ) = _takeFee(WETH, msg.value);
        // Send net WETH to adapter
        IERC20(WETH).safeTransfer(address(uniswapV3Adapter), net);
        amountOut = uniswapV3Adapter.swapExactInV3(WETH, tokenOut, feeTier, recipient, net, amountOutMin);
        emit SwapExecuted(msg.sender, WETH, tokenOut, msg.value, amountOut, "UniswapV3:Native");
    }

    // Native -> ERC20 via V2: wraps native to WETH, takes fee, routes
    function swapExactNativeInViaV2(
        address router,
        address tokenOut,
        uint256 amountOutMin,
        address recipient
    ) external payable nonReentrant returns (uint256 amountOut) {
        require(address(uniswapV2Adapter) != address(0), "V2_ADAPTER_ZERO");
        require(msg.value > 0, "ZERO_MSG_VALUE");
        // Wrap to WETH
        IWETH(WETH).deposit{value: msg.value}();
        (uint256 net, ) = _takeFee(WETH, msg.value);
        IERC20(WETH).safeTransfer(address(uniswapV2Adapter), net);
        address[] memory path = new address[](2);
        path[0] = WETH;
        path[1] = tokenOut;
        amountOut = uniswapV2Adapter.swapExactInV2(router, path, recipient, net, amountOutMin);
        emit SwapExecuted(msg.sender, WETH, tokenOut, msg.value, amountOut, "UniswapV2Like:Native");
    }
}
