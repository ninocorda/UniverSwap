// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { Clones } from "@openzeppelin/contracts/proxy/Clones.sol";
import { IERC20Template } from "./interfaces/IERC20Template.sol";

/// @title TokenFactory deploying standalone ERC20 templates with tiered premium features
contract TokenFactory is Ownable {
    // --------------------------------------------------
    // Feature bitmask
    // --------------------------------------------------
    uint256 private constant FEATURE_CAP = 1 << 0;
    uint256 private constant FEATURE_ROLES = 1 << 1;
    uint256 private constant FEATURE_DISTRIBUTION = 1 << 2;
    uint256 private constant FEATURE_METADATA = 1 << 3;
    uint256 private constant FEATURE_FEES = 1 << 4;
    uint256 private constant FEATURE_AUTO_LIQUIDITY = 1 << 5;
    uint256 private constant FEATURE_ANTI_WHALE = 1 << 6;
    uint256 private constant FEATURE_STAKING = 1 << 7;
    uint256 private constant FEATURE_VESTING = 1 << 8;
    uint256 private constant FEATURE_GOVERNANCE = 1 << 9;
    uint256 private constant FEATURE_BRIDGE = 1 << 10;
    uint256 private constant FEATURE_BRANDING = 1 << 11;
    uint256 private constant FEATURE_LOCK = 1 << 12;
    uint256 private constant FEATURE_PLATFORM_VESTING = 1 << 13;

    uint8 public constant TIER_BASIC = 1;
    uint8 public constant TIER_ADVANCED = 2;
    uint8 public constant TIER_PRO = 3;
    uint8 public constant TIER_DAO = 4;
    uint8 public constant TIER_PREMIUM = 5;
    uint8 public constant TIER_ELITE = 6;

    uint256 private constant BNB_DECIMALS = 1e18;
    uint16 private constant BPS_DENOMINATOR = 10_000;

    struct TierInfo {
        uint256 price; // in wei
        uint256 features;
    }

    struct TokenRecord {
        address creator;
        uint8 tierId;
        uint64 createdAt;
        bytes32 configHash;
    }

    address payable public feeRecipient;
    address public templateImplementation;

    mapping(uint8 => TierInfo) public tierInfo;
    address[] public allTokens;
    mapping(address => TokenRecord) public tokenRecords;

    event TokenCreatedExtended(
        address indexed token,
        address indexed creator,
        uint8 indexed tierId,
        string name,
        string symbol,
        bytes32 configHash,
        string metadataURI,
        string brandingURI
    );

    event TierUpdated(uint8 indexed tierId, uint256 price, uint256 features);
    event FeeRecipientUpdated(address indexed newRecipient);
    event Withdraw(address indexed to, uint256 amount);

    constructor(address template_) Ownable(msg.sender) {
        feeRecipient = payable(msg.sender);
        _setTemplate(template_);

        _setTier(TIER_BASIC, 0.01 ether, 0);
        _setTier(TIER_ADVANCED, 0.015 ether, FEATURE_CAP | FEATURE_ROLES | FEATURE_DISTRIBUTION | FEATURE_METADATA);
        _setTier(
            TIER_PRO,
            0.025 ether,
            FEATURE_CAP | FEATURE_ROLES | FEATURE_DISTRIBUTION | FEATURE_METADATA |
                FEATURE_FEES | FEATURE_AUTO_LIQUIDITY | FEATURE_ANTI_WHALE | FEATURE_STAKING | FEATURE_VESTING |
                FEATURE_LOCK | FEATURE_PLATFORM_VESTING
        );
        _setTier(
            TIER_DAO,
            0.035 ether,
            FEATURE_CAP | FEATURE_ROLES | FEATURE_DISTRIBUTION | FEATURE_METADATA |
                FEATURE_FEES | FEATURE_AUTO_LIQUIDITY | FEATURE_ANTI_WHALE | FEATURE_STAKING | FEATURE_VESTING |
                FEATURE_GOVERNANCE | FEATURE_BRIDGE | FEATURE_LOCK | FEATURE_PLATFORM_VESTING
        );
        _setTier(
            TIER_PREMIUM,
            0.04 ether,
            FEATURE_CAP | FEATURE_ROLES | FEATURE_DISTRIBUTION | FEATURE_METADATA |
                FEATURE_FEES | FEATURE_AUTO_LIQUIDITY | FEATURE_ANTI_WHALE | FEATURE_STAKING | FEATURE_VESTING |
                FEATURE_GOVERNANCE | FEATURE_BRIDGE | FEATURE_BRANDING | FEATURE_LOCK | FEATURE_PLATFORM_VESTING
        );
        _setTier(
            TIER_ELITE,
            0.1 ether,
            FEATURE_CAP | FEATURE_ROLES | FEATURE_DISTRIBUTION | FEATURE_METADATA |
                FEATURE_FEES | FEATURE_AUTO_LIQUIDITY | FEATURE_ANTI_WHALE | FEATURE_STAKING | FEATURE_VESTING |
                FEATURE_GOVERNANCE | FEATURE_BRIDGE | FEATURE_BRANDING | FEATURE_LOCK | FEATURE_PLATFORM_VESTING
        );
    }

    // --------------------------------------------------
    // External admin
    // --------------------------------------------------
    function setTier(uint8 tierId, uint256 price, uint256 features) external onlyOwner {
        require(tierId >= TIER_BASIC && tierId <= TIER_ELITE, "TIER_RANGE");
        require(price > 0, "PRICE_ZERO");
        _setTier(tierId, price, features);
    }

    function setTemplateImplementation(address template_) external onlyOwner {
        _setTemplate(template_);
    }

    function setFeeRecipient(address payable newRecipient) external onlyOwner {
        require(newRecipient != address(0), "RECIPIENT_ZERO");
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(newRecipient);
    }

    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "WITHDRAW_ZERO");
        require(amount <= address(this).balance, "BALANCE_LOW");
        to.transfer(amount);
        emit Withdraw(to, amount);
    }

    // --------------------------------------------------
    // Public view helpers
    // --------------------------------------------------
    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    // --------------------------------------------------
    // Core creation flow
    // --------------------------------------------------
    function createToken(
        uint8 tierId,
        IERC20Template.TokenInit memory init,
        IERC20Template.TokenConfig calldata cfg
    ) external payable returns (address token) {
        TierInfo memory tier = tierInfo[tierId];
        require(tier.price > 0, "TIER_UNKNOWN");

        require(msg.value >= tier.price, "PRICE_INSUFFICIENT");

        init.owner = msg.sender;
        init.tierId = tierId;
        init.templateVersion = 0; // let template assign current

        _validateConfig(tier.features, init.owner, tierId, cfg);

        address proxy = Clones.clone(templateImplementation);
        IERC20Template tokenInstance = IERC20Template(proxy);
        tokenInstance.initialize(init, cfg);
        token = proxy;

        bytes32 cfgHash = keccak256(abi.encode(cfg));
        tokenRecords[token] = TokenRecord({
            creator: msg.sender,
            tierId: tierId,
            createdAt: uint64(block.timestamp),
            configHash: cfgHash
        });
        allTokens.push(token);

        emit TokenCreatedExtended(token, msg.sender, tierId, init.name, init.symbol, cfgHash, cfg.metadataURI, cfg.brandingURI);

        address payable recipient = feeRecipient != address(0) ? feeRecipient : payable(owner());
        (bool feeSent, ) = recipient.call{value: tier.price}("");
        require(feeSent, "FEE_TRANSFER_FAILED");

        if (msg.value > tier.price) {
            unchecked {
                payable(msg.sender).transfer(msg.value - tier.price);
            }
        }
    }

    // --------------------------------------------------
    // Internal helpers
    // --------------------------------------------------
    function _setTier(uint8 tierId, uint256 price, uint256 features) private {
        tierInfo[tierId] = TierInfo({ price: price, features: features });
        emit TierUpdated(tierId, price, features);
    }

    function _setTemplate(address template_) private {
        require(template_ != address(0), "TEMPLATE_ZERO");
        templateImplementation = template_;
    }

    function _validateConfig(
        uint256 tierFeatures,
        address owner,
        uint8 tierId,
        IERC20Template.TokenConfig calldata cfg
    ) private pure {
        require(cfg.initialDistribution.length > 0 || cfg.initialSupply == 0, "DIST_REQUIRED");

        uint256 requiredFeatures;

        if (cfg.cap > 0) {
            _assertFeature(tierFeatures, FEATURE_CAP, tierId, "CAP_FORBIDDEN");
            requiredFeatures |= FEATURE_CAP;
            require(cfg.cap >= cfg.initialSupply, "CAP_LT_SUPPLY");
        }

        if (cfg.minters.length > 0 || cfg.pausers.length > 0 || cfg.burners.length > 0 || cfg.bridgeOperators.length > 0) {
            _assertFeature(tierFeatures, FEATURE_ROLES, tierId, "ROLES_FORBIDDEN");
            requiredFeatures |= FEATURE_ROLES;
        }

        // Distribution checks
        uint256 totalDistribution;
        bool hasVesting;
        bool nonOwnerRecipient;
        for (uint256 i = 0; i < cfg.initialDistribution.length; i++) {
            IERC20Template.InitRecipient calldata dist = cfg.initialDistribution[i];
            totalDistribution += dist.amount;
            if (dist.vesting) {
                hasVesting = true;
            }
            if (dist.account != owner) {
                nonOwnerRecipient = true;
            }
        }

        if (cfg.initialDistribution.length > 1 || nonOwnerRecipient || hasVesting) {
            requiredFeatures |= FEATURE_DISTRIBUTION;
            _assertFeature(tierFeatures, FEATURE_DISTRIBUTION, tierId, "DIST_FORBIDDEN");
        } else {
            IERC20Template.InitRecipient calldata onlyDist = cfg.initialDistribution[0];
            require(!onlyDist.vesting, "VESTING_BASIC");
            require(onlyDist.account == owner, "BASIC_OWNER_DIST");
        }

        if (bytes(cfg.metadataURI).length > 0) {
            requiredFeatures |= FEATURE_METADATA;
            _assertFeature(tierFeatures, FEATURE_METADATA, tierId, "META_FORBIDDEN");
        }
        if (bytes(cfg.brandingURI).length > 0) {
            requiredFeatures |= FEATURE_BRANDING;
            _assertFeature(tierFeatures, FEATURE_BRANDING, tierId, "BRANDING_FORBIDDEN");
        }

        if (cfg.fees.length > 0 || cfg.stakingEnabled) {
            requiredFeatures |= FEATURE_FEES;
            _assertFeature(tierFeatures, FEATURE_FEES, tierId, "FEES_FORBIDDEN");
        }

        if (cfg.autoLiquidityEnabled || cfg.autoLiquidityBps > 0) {
            requiredFeatures |= FEATURE_AUTO_LIQUIDITY;
            _assertFeature(tierFeatures, FEATURE_AUTO_LIQUIDITY, tierId, "LIQ_FORBIDDEN");
            require(cfg.autoLiquidityRouter != address(0), "ROUTER_REQ");
        } else {
            require(cfg.autoLiquidityRouter == address(0), "ROUTER_UNUSED");
            require(cfg.autoLiquidityPairToken == address(0), "PAIR_UNUSED");
            require(cfg.autoLiquidityBps == 0, "BPS_UNUSED");
        }

        if (cfg.antiWhaleEnabled || cfg.antiWhale.enabled) {
            requiredFeatures |= FEATURE_ANTI_WHALE;
            _assertFeature(tierFeatures, FEATURE_ANTI_WHALE, tierId, "AW_FORBIDDEN");
            require(cfg.antiWhale.maxTxAmount > 0 || cfg.antiWhale.maxWalletAmount > 0, "AW_PARAMS");
        }

        if (cfg.stakingEnabled && cfg.fees.length > 0) {
            requiredFeatures |= FEATURE_STAKING;
            _assertFeature(tierFeatures, FEATURE_STAKING, tierId, "STAKING_FORBIDDEN");
            require(cfg.stakingManager != address(0), "STAKING_MANAGER");
        } else {
            require(cfg.stakingManager == address(0), "STAKING_UNUSED");
        }

        if (hasVesting) {
            requiredFeatures |= FEATURE_VESTING;
            _assertFeature(tierFeatures, FEATURE_VESTING, tierId, "VESTING_FORBIDDEN");
            for (uint256 i = 0; i < cfg.initialDistribution.length; i++) {
                if (cfg.initialDistribution[i].vesting) {
                    IERC20Template.InitRecipient calldata dist = cfg.initialDistribution[i];
                    require(dist.duration >= dist.cliff, "VEST_DURATION");
                }
            }
        }

        if (cfg.governanceEnabled) {
            requiredFeatures |= FEATURE_GOVERNANCE;
            _assertFeature(tierFeatures, FEATURE_GOVERNANCE, tierId, "GOV_FORBIDDEN");
        }

        if (cfg.bridgeOperators.length > 0) {
            requiredFeatures |= FEATURE_BRIDGE;
            _assertFeature(tierFeatures, FEATURE_BRIDGE, tierId, "BRIDGE_FORBIDDEN");
        }

        // Supply consistency
        uint256 liquidityReserve;
        if (cfg.autoLiquidityEnabled && cfg.autoLiquidityBps > 0) {
            liquidityReserve = (cfg.initialSupply * cfg.autoLiquidityBps) / BPS_DENOMINATOR;
        }

        uint256 stakingReserve;
        if (cfg.stakingEnabled) {
            for (uint256 i = 0; i < cfg.fees.length; i++) {
                if (cfg.fees[i].feeType == IERC20Template.FeeType.Staking) {
                    stakingReserve += (cfg.initialSupply * cfg.fees[i].bps) / BPS_DENOMINATOR;
                }
            }
        }

        require(totalDistribution + liquidityReserve + stakingReserve == cfg.initialSupply, "SUPPLY_MISMATCH");
    }

    function _assertFeature(uint256 tierFeatures, uint256 feature, uint8 tierId, string memory err) private pure {
        if ((tierFeatures & feature) == 0) {
            revert(string.concat(err, "_TIER"));
        }
    }
}
