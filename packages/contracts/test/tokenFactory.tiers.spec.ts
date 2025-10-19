import "@nomicfoundation/hardhat-chai-matchers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

const TIER_BASIC = 1;
const TIER_ADVANCED = 2;
const TIER_PRO = 3;
const TIER_DAO = 4;
const TIER_PREMIUM = 5;

const BPS_DENOMINATOR = 10_000n;
const toUnit = (value: string | number) => ethers.parseUnits(String(value), 18);

async function deployFactoryFixture() {
  const [owner, creator, other, extra] = await ethers.getSigners();

  const Template = await ethers.getContractFactory("ERC20Template");
  const template = await Template.deploy();
  await template.waitForDeployment();

  const Factory = await ethers.getContractFactory("TokenFactory");
  const factory = await Factory.deploy(await template.getAddress());
  await factory.waitForDeployment();

  return {
    owner,
    creator,
    other,
    extra,
    factory: factory as any,
  };
}

describe("TokenFactory tiers", () => {
  describe("Tier 1 — Basic", () => {
    it("deploys a basic token with mint/burn/pause options", async () => {
      const { creator, other, factory } = await loadFixture(deployFactoryFixture);

      const initialSupply = toUnit(1000);

      const init = {
        name: "Basic Token",
        symbol: "BASIC",
        decimals: 18,
        owner: creator.address,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply,
        cap: 0n,
        mintable: true,
        burnable: true,
        pausable: true,
        governanceEnabled: false,
        autoLiquidityEnabled: false,
        antiWhaleEnabled: false,
        stakingEnabled: false,
        autoLiquidityBps: 0,
        autoLiquidityRouter: ethers.ZeroAddress,
        autoLiquidityPairToken: ethers.ZeroAddress,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "",
        brandingURI: "",
        fees: [],
        initialDistribution: [
          {
            account: creator.address,
            amount: initialSupply,
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
        ],
        minters: [],
        pausers: [],
        burners: [],
        bridgeOperators: [],
        antiWhale: {
          enabled: false,
          maxTxAmount: 0n,
          maxWalletAmount: 0n,
          cooldownBlocks: 0,
        },
      };

      await factory.connect(creator).createToken(TIER_BASIC, init, cfg, {
        value: ethers.parseEther("0.01"),
      });

      const tokenAddr = await factory.allTokens(0);
      const token = (await ethers.getContractAt("ERC20Template", tokenAddr)) as any;

      expect(await token.balanceOf(creator.address)).to.equal(initialSupply);

      const MINTER_ROLE = await token.MINTER_ROLE();
      await expect(
        token.connect(other).mint(other.address, 1n)
      )
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(other.address, MINTER_ROLE);
      await token.connect(creator).mint(creator.address, 1n);
      expect(await token.balanceOf(creator.address)).to.equal(initialSupply + 1n);

      await token.connect(creator).pause();
      await expect(token.connect(creator).transfer(other.address, 10n)).to.be.revertedWith(
        "TOKEN_PAUSED"
      );
      await token.connect(creator).unpause();
      await token.connect(creator).transfer(other.address, 10n);
      expect(await token.balanceOf(other.address)).to.equal(10n);

      await token.connect(creator).burn(10n);
      expect(await token.hasRole(MINTER_ROLE, creator.address)).to.equal(true);
    });

    it("reverts when enabling forbidden features in basic tier", async () => {
      const { creator, factory } = await loadFixture(deployFactoryFixture);

      const init = {
        name: "Bad Basic",
        symbol: "BAD",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply: toUnit(500),
        cap: 0n,
        mintable: true,
        burnable: true,
        pausable: true,
        governanceEnabled: false,
        autoLiquidityEnabled: false,
        antiWhaleEnabled: false,
        stakingEnabled: false,
        autoLiquidityBps: 0,
        autoLiquidityRouter: ethers.ZeroAddress,
        autoLiquidityPairToken: ethers.ZeroAddress,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "",
        brandingURI: "",
        fees: [
          {
            feeType: 0,
            bps: 100,
            recipient: creator.address,
          },
        ],
        initialDistribution: [
          {
            account: creator.address,
            amount: toUnit(500),
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
        ],
        minters: [],
        pausers: [],
        burners: [],
        bridgeOperators: [],
        antiWhale: {
          enabled: false,
          maxTxAmount: 0n,
          maxWalletAmount: 0n,
          cooldownBlocks: 0,
        },
      };

      await expect(
        factory.connect(creator).createToken(TIER_BASIC, init, cfg, {
          value: ethers.parseEther("0.01"),
        })
      ).to.be.revertedWith("FEES_FORBIDDEN_TIER");
    });
  });

  describe("Tier 2 — Advanced", () => {
    it("permite cap, múltiples destinatarios y roles extendidos", async () => {
      const { creator, other, factory } = await loadFixture(deployFactoryFixture);

      const initialSupply = toUnit(1000);
      const init = {
        name: "Advanced Token",
        symbol: "ADV",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply,
        cap: toUnit(2000),
        mintable: true,
        burnable: true,
        pausable: true,
        governanceEnabled: false,
        autoLiquidityEnabled: false,
        antiWhaleEnabled: false,
        stakingEnabled: false,
        autoLiquidityBps: 0,
        autoLiquidityRouter: ethers.ZeroAddress,
        autoLiquidityPairToken: ethers.ZeroAddress,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "ipfs://sample-metadata",
        brandingURI: "",
        fees: [],
        initialDistribution: [
          {
            account: creator.address,
            amount: toUnit(700),
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
          {
            account: other.address,
            amount: toUnit(300),
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
        ],
        minters: [other.address],
        pausers: [other.address],
        burners: [],
        bridgeOperators: [],
        antiWhale: {
          enabled: false,
          maxTxAmount: 0n,
          maxWalletAmount: 0n,
          cooldownBlocks: 0,
        },
      };

      await factory.connect(creator).createToken(TIER_ADVANCED, init, cfg, {
        value: ethers.parseEther("0.015"),
      });

      const tokenAddr = await factory.allTokens(0);
      const token = (await ethers.getContractAt("ERC20Template", tokenAddr)) as any;

      expect(await token.cap()).to.equal(cfg.cap);
      expect(await token.metadataURI()).to.equal(cfg.metadataURI);
      expect(await token.balanceOf(creator.address)).to.equal(cfg.initialDistribution[0].amount);
      expect(await token.balanceOf(other.address)).to.equal(cfg.initialDistribution[1].amount);

      const MINTER_ROLE = await token.MINTER_ROLE();
      const PAUSER_ROLE = await token.PAUSER_ROLE();
      expect(await token.hasRole(MINTER_ROLE, other.address)).to.equal(true);
      expect(await token.hasRole(PAUSER_ROLE, other.address)).to.equal(true);

      await token.connect(other).mint(other.address, toUnit(500));
      await expect(
        token.connect(other).mint(other.address, toUnit(1200))
      ).to.be.revertedWith("CAP_EXCEEDED");

      await token.connect(other).pause();
      await expect(token.connect(other).transfer(creator.address, 1n)).to.be.revertedWith(
        "TOKEN_PAUSED"
      );
      await token.connect(other).unpause();
    });

    it("rechaza governance en tier avanzado", async () => {
      const { creator, factory } = await loadFixture(deployFactoryFixture);

      const init = {
        name: "Gov Try",
        symbol: "GTRY",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply: toUnit(100),
        cap: 0n,
        mintable: false,
        burnable: false,
        pausable: false,
        governanceEnabled: true,
        autoLiquidityEnabled: false,
        antiWhaleEnabled: false,
        stakingEnabled: false,
        autoLiquidityBps: 0,
        autoLiquidityRouter: ethers.ZeroAddress,
        autoLiquidityPairToken: ethers.ZeroAddress,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "",
        brandingURI: "",
        fees: [],
        initialDistribution: [
          {
            account: creator.address,
            amount: toUnit(100),
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
        ],
        minters: [],
        pausers: [],
        burners: [],
        bridgeOperators: [],
        antiWhale: {
          enabled: false,
          maxTxAmount: 0n,
          maxWalletAmount: 0n,
          cooldownBlocks: 0,
        },
      };

      await expect(
        factory.connect(creator).createToken(TIER_ADVANCED, init, cfg, {
          value: ethers.parseEther("0.015"),
        })
      ).to.be.revertedWith("GOV_FORBIDDEN_TIER");
    });
  });

  describe("Tier 3 — Pro", () => {
    it("maneja auto-liquidez, fees y límites anti-whale", async () => {
      const { creator, other, extra, factory } = await loadFixture(deployFactoryFixture);

      const liquidityBps = 500;
      const treasuryBps = 100;
      const burnBps = 50;
      const totalFeeBps = BigInt(treasuryBps + burnBps);
      const initialSupply = toUnit(1000);
      const liquidityReserve = (initialSupply * BigInt(liquidityBps)) / BPS_DENOMINATOR;
      const distributionAmount = initialSupply - liquidityReserve;

      const init = {
        name: "Pro Token",
        symbol: "PRO",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply,
        cap: 0n,
        mintable: false,
        burnable: true,
        pausable: true,
        governanceEnabled: false,
        autoLiquidityEnabled: true,
        antiWhaleEnabled: true,
        stakingEnabled: false,
        autoLiquidityBps: liquidityBps,
        autoLiquidityRouter: creator.address,
        autoLiquidityPairToken: other.address,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "",
        brandingURI: "",
        fees: [
          { feeType: 0, bps: treasuryBps, recipient: extra.address },
          { feeType: 1, bps: burnBps, recipient: ethers.ZeroAddress },
        ],
        initialDistribution: [
          {
            account: creator.address,
            amount: distributionAmount,
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
        ],
        minters: [],
        pausers: [],
        burners: [],
        bridgeOperators: [],
        antiWhale: {
          enabled: true,
          maxTxAmount: toUnit(80),
          maxWalletAmount: toUnit(60),
          cooldownBlocks: 0,
        },
      };

      await factory.connect(creator).createToken(TIER_PRO, init, cfg, {
        value: ethers.parseEther("0.025"),
      });

      const tokenAddr = await factory.allTokens(0);
      const token = (await ethers.getContractAt("ERC20Template", tokenAddr)) as any;

      expect(await token.autoLiquidityEnabled()).to.equal(true);
      expect(await token.liquidityAccumulator()).to.equal(liquidityReserve);

      const withdrawalBalanceBefore = await token.balanceOf(creator.address);
      await token.connect(creator).withdrawLiquidityReserve(creator.address, liquidityReserve);
      expect(await token.liquidityAccumulator()).to.equal(0n);

      const transferAmount = toUnit(30);
      const treasuryFee = (transferAmount * BigInt(treasuryBps)) / BPS_DENOMINATOR;
      const burnFee = (transferAmount * BigInt(burnBps)) / BPS_DENOMINATOR;
      const treasuryFromWithdrawal =
        (liquidityReserve * BigInt(treasuryBps)) / BPS_DENOMINATOR;
      const burnFromWithdrawal = (liquidityReserve * BigInt(burnBps)) / BPS_DENOMINATOR;
      const netLiquidityWithdrawal = liquidityReserve - treasuryFromWithdrawal - burnFromWithdrawal;

      expect(await token.balanceOf(creator.address)).to.equal(
        withdrawalBalanceBefore + netLiquidityWithdrawal
      );

      const expectedTreasuryBalance = treasuryFromWithdrawal + treasuryFee;

      await token.connect(creator).transfer(other.address, transferAmount);
      expect(await token.balanceOf(extra.address)).to.equal(expectedTreasuryBalance);

      const walletLimit = cfg.antiWhale.maxWalletAmount;
      const currentOtherBalance = await token.balanceOf(other.address);
      const transferThatHitsLimit = walletLimit - currentOtherBalance;
      expect(transferThatHitsLimit).to.be.greaterThan(0n);

      const denominator = BPS_DENOMINATOR - totalFeeBps;
      const requiredGross = ((transferThatHitsLimit * BPS_DENOMINATOR) / denominator) + 1n;

      await expect(
        token.connect(creator).transfer(other.address, requiredGross)
      ).to.be.revertedWith("MAX_WALLET_EXCEEDED");

      const ANTIWHALE_EXEMPT_ROLE = await token.ANTIWHALE_EXEMPT_ROLE();
      await token.connect(creator).grantRole(ANTIWHALE_EXEMPT_ROLE, extra.address);

      const maxTxRemaining = cfg.antiWhale.maxTxAmount;
      const numeratorTx = maxTxRemaining + 1n;
      const requiredGrossTx = ((numeratorTx * BPS_DENOMINATOR) / denominator) + 1n;

      await expect(
        token.connect(creator).transfer(extra.address, requiredGrossTx)
      ).to.be.revertedWith("MAX_TX_EXCEEDED");

      const expectedSupply = initialSupply - burnFee - burnFromWithdrawal;
      expect(await token.totalSupply()).to.equal(expectedSupply);
    });
  });

  describe("Tier 4 — DAO", () => {
    it("gestiona governance, vesting y bridge", async () => {
      const { creator, other, factory } = await loadFixture(deployFactoryFixture);

      const vestingAmount = toUnit(500);
      const immediateAmount = toUnit(500);

      const init = {
        name: "DAO Token",
        symbol: "DAO",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const now = await time.latest();
      const cfg = {
        initialSupply: toUnit(1000),
        cap: toUnit(5000),
        mintable: true,
        burnable: true,
        pausable: true,
        governanceEnabled: true,
        autoLiquidityEnabled: false,
        antiWhaleEnabled: false,
        stakingEnabled: false,
        autoLiquidityBps: 0,
        autoLiquidityRouter: ethers.ZeroAddress,
        autoLiquidityPairToken: ethers.ZeroAddress,
        stakingManager: ethers.ZeroAddress,
        metadataURI: "",
        brandingURI: "",
        fees: [],
        initialDistribution: [
          {
            account: creator.address,
            amount: immediateAmount,
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
          {
            account: creator.address,
            amount: vestingAmount,
            vesting: true,
            vestingStart: BigInt(now),
            cliff: 60,
            duration: 3600,
            revocable: true,
          },
        ],
        minters: [],
        pausers: [],
        burners: [],
        bridgeOperators: [creator.address],
        antiWhale: {
          enabled: false,
          maxTxAmount: 0n,
          maxWalletAmount: 0n,
          cooldownBlocks: 0,
        },
      };

      await factory.connect(creator).createToken(TIER_DAO, init, cfg, {
        value: ethers.parseEther("0.035"),
      });

      const tokenAddr = await factory.allTokens(0);
      const token = (await ethers.getContractAt("ERC20Template", tokenAddr)) as any;

      const [, tierId, governanceEnabled, liquidity, antiWhale, staking] =
        await token.versionedInfo();
      expect(tierId).to.equal(BigInt(TIER_DAO));
      expect(governanceEnabled).to.equal(true);
      expect(liquidity).to.equal(false);
      expect(antiWhale).to.equal(false);
      expect(staking).to.equal(false);

      expect(await token.vestingCount(creator.address)).to.equal(1n);
      await expect(
        token.connect(creator).releaseVested(creator.address, 0)
      ).to.be.revertedWith("NOTHING_TO_RELEASE");

      await time.increase(3600);
      const releasable = await token.releasableAmount(creator.address, 0);
      expect(releasable).to.equal(vestingAmount);

      const balanceBefore = await token.balanceOf(creator.address);
      await token.connect(creator).releaseVested(creator.address, 0);
      expect(await token.balanceOf(creator.address)).to.equal(balanceBefore + releasable);

      await token.connect(creator).delegate(creator.address);
      await ethers.provider.send("evm_mine", []);
      expect(await token.getVotes(creator.address)).to.equal(
        await token.balanceOf(creator.address)
      );

      const bridgeAmount = toUnit(100);
      await token.connect(creator).bridgeMint(other.address, bridgeAmount);
      expect(await token.balanceOf(other.address)).to.equal(bridgeAmount);

      await token.connect(creator).bridgeBurn(other.address, toUnit(40));
      expect(await token.balanceOf(other.address)).to.equal(toUnit(60));

      const BRIDGE_ROLE = await token.BRIDGE_ROLE();
      await expect(
        token.connect(other).bridgeMint(other.address, 1n)
      )
        .to.be.revertedWithCustomError(token, "AccessControlUnauthorizedAccount")
        .withArgs(other.address, BRIDGE_ROLE);
    });
  });

  describe("Tier 5 — Premium", () => {
    it("configura branding, staking y anti-whale avanzados", async () => {
      const { creator, other, extra, factory } = await loadFixture(deployFactoryFixture);

      const liquidityBps = 1000;
      const treasuryBps = 100;
      const stakingBps = 50;
      const initialSupply = toUnit(1000);
      const liquidityReserve = (initialSupply * BigInt(liquidityBps)) / BPS_DENOMINATOR;
      const stakingReserve = (initialSupply * BigInt(stakingBps)) / BPS_DENOMINATOR;
      const vestingAmount = toUnit(200);
      const immediateAmount = initialSupply - liquidityReserve - stakingReserve - vestingAmount;
      const now = await time.latest();

      const init = {
        name: "Premium Token",
        symbol: "PREM",
        decimals: 18,
        owner: ethers.ZeroAddress,
        tierId: 0,
        templateVersion: 0n,
      } as const;

      const cfg = {
        initialSupply,
        cap: toUnit(2000),
        mintable: true,
        burnable: true,
        pausable: true,
        governanceEnabled: true,
        autoLiquidityEnabled: true,
        antiWhaleEnabled: true,
        stakingEnabled: true,
        autoLiquidityBps: liquidityBps,
        autoLiquidityRouter: creator.address,
        autoLiquidityPairToken: other.address,
        stakingManager: extra.address,
        metadataURI: "ipfs://meta",
        brandingURI: "ipfs://branding",
        fees: [
          { feeType: 0, bps: 100, recipient: extra.address },
          { feeType: 3, bps: stakingBps, recipient: extra.address },
        ],
        initialDistribution: [
          {
            account: creator.address,
            amount: immediateAmount,
            vesting: false,
            vestingStart: 0,
            cliff: 0,
            duration: 0,
            revocable: false,
          },
          {
            account: creator.address,
            amount: vestingAmount,
            vesting: true,
            vestingStart: BigInt(now + 60),
            cliff: 0,
            duration: 1800,
            revocable: false,
          },
        ],
        minters: [creator.address],
        pausers: [creator.address],
        burners: [creator.address],
        bridgeOperators: [creator.address],
        antiWhale: {
          enabled: true,
          maxTxAmount: toUnit(400),
          maxWalletAmount: toUnit(600),
          cooldownBlocks: 0,
        },
      };

      await factory.connect(creator).createToken(TIER_PREMIUM, init, cfg, {
        value: ethers.parseEther("0.04"),
      });

      const tokenAddr = await factory.allTokens(0);
      const token = (await ethers.getContractAt("ERC20Template", tokenAddr)) as any;

      const [, tierId, governanceEnabled, liquidity, antiWhale, staking] =
        await token.versionedInfo();
      expect(tierId).to.equal(BigInt(TIER_PREMIUM));
      expect(governanceEnabled).to.equal(true);
      expect(liquidity).to.equal(true);
      expect(antiWhale).to.equal(true);
      expect(staking).to.equal(true);

      expect(await token.metadataURI()).to.equal("ipfs://meta");
      expect(await token.brandingURI()).to.equal("ipfs://branding");

      expect(await token.liquidityAccumulator()).to.equal(liquidityReserve);
      expect(await token.stakingReserve()).to.equal(stakingReserve);

      const stakingTransferAmount = stakingReserve / 2n;
      const reserveBefore = await token.stakingReserve();
      const extraBalanceBefore = await token.balanceOf(extra.address);
      await token.connect(creator).depositToStaking(stakingTransferAmount);

      const stakingFeePortion = (stakingTransferAmount * BigInt(stakingBps)) / BPS_DENOMINATOR;

      expect(await token.stakingReserve()).to.equal(reserveBefore - stakingTransferAmount);
      expect(await token.balanceOf(extra.address)).to.equal(
        extraBalanceBefore + stakingTransferAmount
      );

      await expect(
        token.connect(creator).releaseVested(creator.address, 0)
      ).to.be.revertedWith("NOTHING_TO_RELEASE");
      await time.increase(1800);
      const releasable = await token.releasableAmount(creator.address, 0);
      expect(releasable).to.equal(vestingAmount);
      const balanceBefore = await token.balanceOf(creator.address);
      await token.connect(creator).releaseVested(creator.address, 0);
      expect(await token.balanceOf(creator.address)).to.equal(balanceBefore + releasable);

      const transferAmount = toUnit(300);
      await token.connect(creator).transfer(other.address, transferAmount);
      await expect(
        token.connect(creator).transfer(other.address, toUnit(250))
      ).to.be.revertedWith("MAX_WALLET_EXCEEDED");

      await expect(
        token.connect(creator).transfer(extra.address, toUnit(450))
      ).to.be.revertedWith("MAX_TX_EXCEEDED");

      await token.connect(creator).withdrawLiquidityReserve(creator.address, toUnit(50));
      expect(await token.liquidityAccumulator()).to.equal(liquidityReserve - toUnit(50));
    });
  });
});
