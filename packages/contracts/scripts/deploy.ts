import { ethers } from "hardhat";
import fs from "node:fs";
import path from "node:path";

const FEATURE_FLAGS = [
  { name: "CAP", bit: 1n << 0n },
  { name: "ROLES", bit: 1n << 1n },
  { name: "DISTRIBUTION", bit: 1n << 2n },
  { name: "METADATA", bit: 1n << 3n },
  { name: "FEES", bit: 1n << 4n },
  { name: "AUTO_LIQ", bit: 1n << 5n },
  { name: "ANTI_WHALE", bit: 1n << 6n },
  { name: "STAKING", bit: 1n << 7n },
  { name: "VESTING", bit: 1n << 8n },
  { name: "GOVERNANCE", bit: 1n << 9n },
  { name: "BRIDGE", bit: 1n << 10n },
  { name: "BRANDING", bit: 1n << 11n },
];

const TIER_LABELS: Record<number, string> = {
  1: "Basic",
  2: "Advanced",
  3: "Pro",
  4: "DAO",
  5: "Premium",
};

type DeploymentRecord = {
  chainId: number;
  network: string;
  contract: string;
  address: string;
  deployer: string;
  timestamp: string;
  implementation?: string;
};

function saveDeployment(filename: string, record: DeploymentRecord) {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const filePath = path.join(deploymentsDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  console.log(`📝 Saved deployment → ${filePath}`);
}

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🪪 Deployer:", deployer.address);

  console.log("🚀 Deploying ERC20Template...");
  const templateFactory = await ethers.getContractFactory("ERC20Template");
  const template = await templateFactory.deploy();
  await template.waitForDeployment();
  const templateAddress = await template.getAddress();
  console.log("✅ ERC20Template:", templateAddress);

  const chainId = await deployer.provider!.getNetwork().then((n) => Number(n.chainId));
  const network = chainId === 97 ? "bscTestnet" : chainId === 56 ? "bsc" : `chain-${chainId}`;
  const timestamp = new Date().toISOString();

  saveDeployment("erc20Template.97.json", {
    chainId,
    network,
    contract: "ERC20Template",
    address: templateAddress,
    deployer: deployer.address,
    timestamp,
  });

  console.log("🚀 Deploying TokenLocker...");
  const tokenLockerFactory = await ethers.getContractFactory("TokenLocker");
  const tokenLocker = await tokenLockerFactory.deploy();
  await tokenLocker.waitForDeployment();
  const tokenLockerAddress = await tokenLocker.getAddress();
  console.log("✅ TokenLocker:", tokenLockerAddress);

  console.log("🚀 Deploying TokenVesting...");
  const tokenVestingFactory = await ethers.getContractFactory("TokenVesting");
  const tokenVesting = await tokenVestingFactory.deploy();
  await tokenVesting.waitForDeployment();
  const tokenVestingAddress = await tokenVesting.getAddress();
  console.log("✅ TokenVesting:", tokenVestingAddress);

  console.log("🚀 Deploying TokenFactory...");
  const tokenFactoryFactory = await ethers.getContractFactory("TokenFactory");
  const tokenFactory = await tokenFactoryFactory.deploy(templateAddress);
  await tokenFactory.waitForDeployment();
  const tokenFactoryAddress = await tokenFactory.getAddress();
  console.log("✅ TokenFactory:", tokenFactoryAddress);

  saveDeployment("tokenLocker.97.json", {
    chainId,
    network,
    contract: "TokenLocker",
    address: tokenLockerAddress,
    deployer: deployer.address,
    timestamp,
  });

  saveDeployment("tokenVesting.97.json", {
    chainId,
    network,
    contract: "TokenVesting",
    address: tokenVestingAddress,
    deployer: deployer.address,
    timestamp,
  });

  saveDeployment("tokenFactory.97.json", {
    chainId,
    network,
    contract: "TokenFactory",
    address: tokenFactoryAddress,
    deployer: deployer.address,
    timestamp,
    implementation: templateAddress,
  });

  console.log("\n📊 Tier configuration summary:");
  for (let tierId = 1; tierId <= 5; tierId += 1) {
    const tier = await tokenFactory.tierInfo(tierId);
    const priceEth = ethers.formatEther(tier.price);
    const featureList = FEATURE_FLAGS.filter((flag) => (tier.features & flag.bit) !== 0n).map((flag) => flag.name);

    console.log(`- Tier ${tierId} (${TIER_LABELS[tierId] ?? "Unknown"})`);
    console.log(`  • Price: ${priceEth} ETH`);
    console.log(`  • Features (${featureList.length}): ${featureList.join(', ') || 'None'}`);
  }

  console.log("\n🔗 Platform contracts:");
  console.log(`  • TokenLocker: ${tokenLockerAddress}`);
  console.log(`  • TokenVesting: ${tokenVestingAddress}`);

  console.log("\nℹ️ Remember to fund the deployer for factory tier purchases or adjust tiers via setTier().");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
