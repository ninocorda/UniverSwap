// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Template {
    enum FeeType { Treasury, Burn, Liquidity, Staking }

    struct FeeSplit {
        FeeType feeType;
        uint16 bps;
        address recipient;
    }

    struct AntiWhaleConfig {
        bool enabled;
        uint256 maxTxAmount;
        uint256 maxWalletAmount;
        uint8 cooldownBlocks;
    }

    struct InitRecipient {
        address account;
        uint256 amount;
        bool vesting;
        uint64 vestingStart;
        uint64 cliff;
        uint64 duration;
        bool revocable;
    }

    struct TokenConfig {
        uint256 initialSupply;
        uint256 cap;
        bool mintable;
        bool burnable;
        bool pausable;
        bool governanceEnabled;
        bool autoLiquidityEnabled;
        bool antiWhaleEnabled;
        bool stakingEnabled;
        uint16 autoLiquidityBps;
        address autoLiquidityRouter;
        address autoLiquidityPairToken;
        address stakingManager;
        string metadataURI;
        string brandingURI;
        FeeSplit[] fees;
        InitRecipient[] initialDistribution;
        address[] minters;
        address[] pausers;
        address[] burners;
        address[] bridgeOperators;
        AntiWhaleConfig antiWhale;
    }

    struct TokenInit {
        string name;
        string symbol;
        uint8 decimals;
        address owner;
        uint8 tierId;
        uint64 templateVersion;
    }

    function initialize(TokenInit memory init_, TokenConfig calldata cfg_) external;
}
