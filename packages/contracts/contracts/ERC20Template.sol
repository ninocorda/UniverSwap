// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {ERC20BurnableUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {ERC20VotesUpgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";

/// @notice Advanced, configurable ERC20 template compatible with TokenFactory tiers.
/// @dev Implements optional mint/burn/pause, fee splits, anti-whale, vesting, governance & liquidity hooks.
contract ERC20Template is
    Initializable,
    ERC20Upgradeable,
    ERC20BurnableUpgradeable,
    PausableUpgradeable,
    AccessControlUpgradeable,
    ERC20VotesUpgradeable,
    ReentrancyGuardUpgradeable
{
    // --------------------------------------------------
    // Roles
    // --------------------------------------------------
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant FEE_MANAGER_ROLE = keccak256("FEE_MANAGER_ROLE");
    bytes32 public constant BRIDGE_ROLE = keccak256("BRIDGE_ROLE");
    bytes32 public constant LIQUIDITY_ROLE = keccak256("LIQUIDITY_ROLE");
    bytes32 public constant ANTIWHALE_EXEMPT_ROLE = keccak256("ANTIWHALE_EXEMPT_ROLE");

    // --------------------------------------------------
    // Constants
    // --------------------------------------------------
    uint16 public constant BPS_DENOMINATOR = 10_000;
    uint16 public constant MAX_FEE_BPS = 300; // 3%
    uint16 public constant MAX_AUTO_LIQUIDITY_BPS = 2000; // 20%

    uint64 public constant CURRENT_TEMPLATE_VERSION = 2;

    // --------------------------------------------------
    // Enums & Structs
    // --------------------------------------------------
    enum FeeType { Treasury, Burn, Liquidity, Staking }

    struct FeeSplit {
        FeeType feeType;
        uint16 bps;
        address recipient; // optional depending on type
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

    struct VestingSchedule {
        uint256 amount;
        uint256 released;
        uint64 start;
        uint64 cliff;
        uint64 duration;
        bool revocable;
        bool revoked;
    }

    // --------------------------------------------------
    // Storage
    // --------------------------------------------------
    uint8 private _customDecimals;
    uint64 public templateVersion;
    uint8 public tierId;

    uint256 public cap;
    bool public mintable;
    bool public burnable;
    bool public pausableEnabled;
    bool public governanceEnabled;
    bool public autoLiquidityEnabled;
    bool public antiWhaleEnabled;
    bool public stakingEnabled;

    string public metadataURI;
    string public brandingURI;

    FeeSplit[] private _feeSplits;
    uint16 public totalFeeBps;

    AntiWhaleConfig private _antiWhale;
    mapping(address => uint256) private _lastTransferBlock;

    mapping(address => VestingSchedule[]) private _vestings;

    uint256 public liquidityAccumulator;
    address public liquidityRouter;
    address public liquidityPairToken;
    uint16 public liquidityBps;

    address public stakingManager;
    uint256 public stakingReserve;

    // --------------------------------------------------
    // Events
    // --------------------------------------------------
    event FeesUpdated(FeeSplit[] fees, uint16 totalFeeBps);
    event AntiWhaleUpdated(AntiWhaleConfig cfg);
    event MetadataUpdated(string newMetadata, string newBranding);
    event LiquidityReserveUpdated(uint256 newReserve, address router, address pairToken);
    event VestingCreated(address indexed beneficiary, uint256 indexed index, VestingSchedule schedule);
    event VestingReleased(address indexed beneficiary, uint256 indexed index, uint256 amount);
    event VestingRevoked(address indexed beneficiary, uint256 indexed index, uint256 refund);

    // --------------------------------------------------
    // Initializer
    // --------------------------------------------------
    function initialize(TokenInit memory init_, TokenConfig calldata cfg_) external initializer {
        require(init_.owner != address(0), "OWNER_ZERO");
        require(bytes(init_.name).length != 0 && bytes(init_.symbol).length != 0, "TOKEN_INFO");

        __ERC20_init(init_.name, init_.symbol);
        __ERC20Burnable_init();
        __Pausable_init();
        __AccessControl_init();
        __ERC20Votes_init();
        __ReentrancyGuard_init();

        _customDecimals = init_.decimals;
        templateVersion = init_.templateVersion == 0 ? CURRENT_TEMPLATE_VERSION : init_.templateVersion;
        tierId = init_.tierId;

        _configureCoreFlags(cfg_);
        _configureRoles(init_.owner, cfg_);
        _configureMetadata(cfg_.metadataURI, cfg_.brandingURI);
        _configureFees(cfg_.fees);
        _configureAntiWhale(cfg_.antiWhale, cfg_.antiWhaleEnabled);
        _configureStaking(cfg_.stakingEnabled, cfg_.stakingManager);
        _configureLiquidity(cfg_);

        _distributeInitialSupply(cfg_.initialSupply, cfg_.initialDistribution);

        _grantRole(ANTIWHALE_EXEMPT_ROLE, address(this));
        _grantRole(ANTIWHALE_EXEMPT_ROLE, init_.owner);
    }

    // --------------------------------------------------
    // Initialization helpers
    // --------------------------------------------------
    function _configureCoreFlags(TokenConfig calldata cfg_) private {
        mintable = cfg_.mintable;
        burnable = cfg_.burnable;
        pausableEnabled = cfg_.pausable;
        governanceEnabled = cfg_.governanceEnabled;
        autoLiquidityEnabled = cfg_.autoLiquidityEnabled;
        antiWhaleEnabled = cfg_.antiWhaleEnabled;
        stakingEnabled = cfg_.stakingEnabled;
        cap = cfg_.cap;
    }

    function _configureRoles(address owner_, TokenConfig calldata cfg_) private {
        _grantRole(DEFAULT_ADMIN_ROLE, owner_);
        if (mintable) {
            _grantRole(MINTER_ROLE, owner_);
            for (uint256 i = 0; i < cfg_.minters.length; i++) {
                _grantRole(MINTER_ROLE, cfg_.minters[i]);
            }
        }
        if (pausableEnabled) {
            _grantRole(PAUSER_ROLE, owner_);
            for (uint256 i = 0; i < cfg_.pausers.length; i++) {
                _grantRole(PAUSER_ROLE, cfg_.pausers[i]);
            }
        }
        if (burnable) {
            _grantRole(BURNER_ROLE, owner_);
            for (uint256 i = 0; i < cfg_.burners.length; i++) {
                _grantRole(BURNER_ROLE, cfg_.burners[i]);
            }
        }
        for (uint256 i = 0; i < cfg_.bridgeOperators.length; i++) {
            _grantRole(BRIDGE_ROLE, cfg_.bridgeOperators[i]);
        }
        _grantRole(FEE_MANAGER_ROLE, owner_);
        _grantRole(LIQUIDITY_ROLE, owner_);
        _grantRole(BRIDGE_ROLE, owner_);
    }

    function _configureMetadata(string memory metadata, string memory branding) private {
        metadataURI = metadata;
        brandingURI = branding;
    }

    function _configureFees(FeeSplit[] calldata fees_) private {
        delete _feeSplits;
        uint16 total;
        for (uint256 i = 0; i < fees_.length; i++) {
            FeeSplit calldata fee = fees_[i];
            require(fee.bps > 0, "FEE_ZERO");
            require(uint8(fee.feeType) <= uint8(FeeType.Staking), "FEE_TYPE");
            if (fee.feeType == FeeType.Treasury || fee.feeType == FeeType.Staking) {
                require(fee.recipient != address(0), "FEE_RECIPIENT");
            }
            _feeSplits.push(fee);
            total += fee.bps;
        }
        require(total <= MAX_FEE_BPS, "FEE_TOO_HIGH");
        totalFeeBps = total;
        emit FeesUpdated(fees_, total);
    }

    function _configureAntiWhale(AntiWhaleConfig calldata cfg_, bool enabled) private {
        if (!enabled) {
            _antiWhale = AntiWhaleConfig(false, 0, 0, 0);
            antiWhaleEnabled = false;
            emit AntiWhaleUpdated(_antiWhale);
            return;
        }
        require(cfg_.maxTxAmount > 0 || cfg_.maxWalletAmount > 0, "AW_CONFIG");
        _antiWhale = cfg_;
        antiWhaleEnabled = true;
        emit AntiWhaleUpdated(cfg_);
    }

    function _configureStaking(bool enabled, address manager) private {
        if (!enabled) {
            stakingEnabled = false;
            stakingManager = address(0);
            return;
        }
        require(manager != address(0), "STAKING_MANAGER");
        stakingEnabled = true;
        stakingManager = manager;
    }

    function _configureLiquidity(TokenConfig calldata cfg_) private {
        if (!cfg_.autoLiquidityEnabled) {
            liquidityRouter = address(0);
            liquidityPairToken = address(0);
            liquidityBps = 0;
            return;
        }
        require(cfg_.autoLiquidityRouter != address(0), "ROUTER_ZERO");
        require(cfg_.autoLiquidityBps <= MAX_AUTO_LIQUIDITY_BPS, "AUTO_BPS");
        liquidityRouter = cfg_.autoLiquidityRouter;
        liquidityPairToken = cfg_.autoLiquidityPairToken;
        liquidityBps = cfg_.autoLiquidityBps;
        autoLiquidityEnabled = true;
    }

    function _distributeInitialSupply(uint256 supply, InitRecipient[] calldata distribution) private {
        if (supply == 0) {
            require(distribution.length == 0, "SUPPLY_ZERO_WITH_DIST");
            return;
        }
        require(distribution.length > 0, "DIST_EMPTY");

        uint256 minted;
        for (uint256 i = 0; i < distribution.length; i++) {
            InitRecipient calldata dist = distribution[i];
            require(dist.account != address(0), "DIST_ACCOUNT");
            require(dist.amount > 0, "DIST_AMOUNT");

            if (dist.vesting) {
                _mint(address(this), dist.amount);
                _createVesting(dist.account, dist);
            } else {
                _mint(dist.account, dist.amount);
            }
            minted += dist.amount;
        }

        uint256 liquidityReserve;
        if (autoLiquidityEnabled && liquidityBps > 0) {
            liquidityReserve = (supply * liquidityBps) / BPS_DENOMINATOR;
            if (liquidityReserve > 0) {
                _mint(address(this), liquidityReserve);
                liquidityAccumulator += liquidityReserve;
            }
        }

        if (stakingEnabled && stakingManager != address(0)) {
            uint256 stakingCut;
            for (uint256 i = 0; i < _feeSplits.length; i++) {
                if (_feeSplits[i].feeType == FeeType.Staking) {
                    stakingCut += (_feeSplits[i].bps * supply) / BPS_DENOMINATOR;
                }
            }
            if (stakingCut > 0) {
                _mint(address(this), stakingCut);
                stakingReserve += stakingCut;
            }
        }

        require(minted + liquidityReserve + stakingReserve == supply, "SUPPLY_MISMATCH");
        emit LiquidityReserveUpdated(liquidityAccumulator, liquidityRouter, liquidityPairToken);
    }

    function _createVesting(address beneficiary, InitRecipient calldata dist) private {
        require(dist.duration >= dist.cliff, "VESTING_DURATION");
        VestingSchedule memory schedule = VestingSchedule({
            amount: dist.amount,
            released: 0,
            start: dist.vestingStart,
            cliff: dist.cliff,
            duration: dist.duration,
            revocable: dist.revocable,
            revoked: false
        });
        _vestings[beneficiary].push(schedule);
        emit VestingCreated(beneficiary, _vestings[beneficiary].length - 1, schedule);
    }

    // --------------------------------------------------
    // External management functions
    // --------------------------------------------------
    function setMetadata(string calldata metadata, string calldata branding) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _configureMetadata(metadata, branding);
        emit MetadataUpdated(metadata, branding);
    }

    function updateFees(FeeSplit[] calldata fees) external onlyRole(FEE_MANAGER_ROLE) {
        _configureFees(fees);
    }

    function updateAntiWhale(AntiWhaleConfig calldata cfg) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _configureAntiWhale(cfg, cfg.enabled);
    }

    function updateLiquidityConfig(address router, address pairToken, uint16 bps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(autoLiquidityEnabled, "AUTO_DISABLED");
        require(router != address(0), "ROUTER_ZERO");
        require(bps <= MAX_AUTO_LIQUIDITY_BPS, "AUTO_BPS");
        liquidityRouter = router;
        liquidityPairToken = pairToken;
        liquidityBps = bps;
        emit LiquidityReserveUpdated(liquidityAccumulator, router, pairToken);
    }

    function withdrawLiquidityReserve(address to, uint256 amount) external onlyRole(LIQUIDITY_ROLE) {
        require(to != address(0), "WITHDRAW_TO_ZERO");
        require(amount <= liquidityAccumulator, "RESERVE_LOW");
        liquidityAccumulator -= amount;
        _transfer(address(this), to, amount);
    }

    function depositToStaking(uint256 amount) external onlyRole(LIQUIDITY_ROLE) {
        require(stakingEnabled, "STAKING_DISABLED");
        require(stakingManager != address(0), "STAKING_MANAGER");
        require(amount <= stakingReserve, "STAKING_RESERVE");
        stakingReserve -= amount;
        _transfer(address(this), stakingManager, amount);
    }

    function releaseVested(address beneficiary, uint256 index) external nonReentrant {
        VestingSchedule storage schedule = _vestings[beneficiary][index];
        require(!schedule.revoked, "VESTING_REVOKED");
        uint256 releasable = _releasableAmount(schedule);
        require(releasable > 0, "NOTHING_TO_RELEASE");
        schedule.released += releasable;
        _transfer(address(this), beneficiary, releasable);
        emit VestingReleased(beneficiary, index, releasable);
    }

    function revokeVesting(address beneficiary, uint256 index) external onlyRole(DEFAULT_ADMIN_ROLE) nonReentrant {
        VestingSchedule storage schedule = _vestings[beneficiary][index];
        require(schedule.revocable, "NOT_REVOCABLE");
        require(!schedule.revoked, "ALREADY_REVOKED");
        uint256 unreleased = schedule.amount - schedule.released;
        schedule.revoked = true;
        if (unreleased > 0) {
            _transfer(address(this), _msgSender(), unreleased);
        }
        emit VestingRevoked(beneficiary, index, unreleased);
    }

    function renounceAllRoles() external {
        address account = _msgSender();
        _revokeRole(MINTER_ROLE, account);
        _revokeRole(PAUSER_ROLE, account);
        _revokeRole(BURNER_ROLE, account);
        _revokeRole(FEE_MANAGER_ROLE, account);
        _revokeRole(LIQUIDITY_ROLE, account);
        _revokeRole(BRIDGE_ROLE, account);
        _revokeRole(ANTIWHALE_EXEMPT_ROLE, account);
        _revokeRole(DEFAULT_ADMIN_ROLE, account);
    }

    function releasableAmount(address beneficiary, uint256 index) external view returns (uint256) {
        VestingSchedule memory schedule = _vestings[beneficiary][index];
        if (schedule.revoked) return 0;
        return _releasableAmount(schedule);
    }

    function vestingCount(address beneficiary) external view returns (uint256) {
        return _vestings[beneficiary].length;
    }

    function getFeeSplits() external view returns (FeeSplit[] memory) {
        FeeSplit[] memory copy = new FeeSplit[](_feeSplits.length);
        for (uint256 i = 0; i < _feeSplits.length; i++) {
            copy[i] = _feeSplits[i];
        }
        return copy;
    }

    function getAntiWhale() external view returns (AntiWhaleConfig memory) {
        return _antiWhale;
    }

    // --------------------------------------------------
    // Core ERC20 overrides & feature gates
    // --------------------------------------------------
    function decimals() public view override returns (uint8) {
        return _customDecimals;
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        require(pausableEnabled, "PAUSE_DISABLED");
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        require(pausableEnabled, "PAUSE_DISABLED");
        _unpause();
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(mintable, "MINT_DISABLED");
        if (cap != 0) {
            require(totalSupply() + amount <= cap, "CAP_EXCEEDED");
        }
        _mint(to, amount);
    }

    function bridgeMint(address to, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        if (cap != 0) {
            require(totalSupply() + amount <= cap, "CAP_EXCEEDED");
        }
        _mint(to, amount);
    }

    function bridgeBurn(address from, uint256 amount) external onlyRole(BRIDGE_ROLE) {
        _burn(from, amount);
    }

    function burn(uint256 amount) public override {
        require(burnable, "BURN_DISABLED");
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount) public override {
        require(burnable, "BURN_DISABLED");
        super.burnFrom(account, amount);
    }

    function _update(address from, address to, uint256 value) internal override(ERC20Upgradeable, ERC20VotesUpgradeable) {
        if (pausableEnabled) {
            require(!paused(), "TOKEN_PAUSED");
        }

        uint256 remaining = value;
        if (from != address(0) && to != address(0) && _feeSplits.length > 0 && totalFeeBps > 0) {
            uint256 totalFee = (value * totalFeeBps) / BPS_DENOMINATOR;
            if (totalFee > 0) {
                remaining = value - totalFee;
                for (uint256 i = 0; i < _feeSplits.length; i++) {
                    FeeSplit memory fee = _feeSplits[i];
                    uint256 feeAmount = (value * fee.bps) / BPS_DENOMINATOR;
                    if (feeAmount == 0) continue;
                    _allocateFee(from, fee, feeAmount);
                }
            }
        }

        if (antiWhaleEnabled && from != address(0)) {
            _enforceAntiWhale(from, to, remaining);
        }

        super._update(from, to, remaining);
    }

    function _allocateFee(address from, FeeSplit memory fee, uint256 amount) private {
        if (fee.feeType == FeeType.Burn) {
            super._update(from, address(0), amount);
        } else if (fee.feeType == FeeType.Liquidity) {
            super._update(from, address(this), amount);
            liquidityAccumulator += amount;
        } else if (fee.feeType == FeeType.Staking) {
            super._update(from, address(this), amount);
            stakingReserve += amount;
        } else {
            super._update(from, fee.recipient, amount);
        }
    }

    function _enforceAntiWhale(address from, address to, uint256 amountAfterFees) private {
        if (!_antiWhale.enabled) return;
        bool fromExempt = hasRole(ANTIWHALE_EXEMPT_ROLE, from);
        bool toExempt = hasRole(ANTIWHALE_EXEMPT_ROLE, to);

        if (!fromExempt && _antiWhale.maxTxAmount > 0) {
            require(amountAfterFees <= _antiWhale.maxTxAmount, "MAX_TX_EXCEEDED");
            if (_antiWhale.cooldownBlocks > 0) {
                uint256 lastBlock = _lastTransferBlock[from];
                require(block.number > lastBlock + _antiWhale.cooldownBlocks, "COOLDOWN_ACTIVE");
                _lastTransferBlock[from] = block.number;
            }
        }

        if (!toExempt && to != address(0) && _antiWhale.maxWalletAmount > 0) {
            require(balanceOf(to) + amountAfterFees <= _antiWhale.maxWalletAmount, "MAX_WALLET_EXCEEDED");
        }
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControlUpgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // --------------------------------------------------
    // Internal helpers
    // --------------------------------------------------
    function _releasableAmount(VestingSchedule memory schedule) private view returns (uint256) {
        if (block.timestamp <= schedule.start + schedule.cliff) {
            return 0;
        }
        if (schedule.revoked) {
            return 0;
        }
        if (schedule.duration == 0) {
            return schedule.amount - schedule.released;
        }
        if (block.timestamp >= schedule.start + schedule.duration) {
            return schedule.amount - schedule.released;
        }
        uint256 elapsed = block.timestamp - schedule.start;
        uint256 vested = (schedule.amount * elapsed) / schedule.duration;
        return vested - schedule.released;
    }

    // --------------------------------------------------
    // View helpers
    // --------------------------------------------------
    function templateVersionConstant() external pure returns (uint64) {
        return CURRENT_TEMPLATE_VERSION;
    }

    function versionedInfo()
        external
        view
        returns (
            uint64 version,
            uint8 tier,
            bool governance,
            bool liquidity,
            bool antiWhale,
            bool staking
        )
    {
        return (templateVersion, tierId, governanceEnabled, autoLiquidityEnabled, antiWhaleEnabled, stakingEnabled);
    }
}
