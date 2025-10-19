import { ethers, network } from "hardhat";
import fs from "fs";
import path from "path";

/*
Deploys Aggregator suite:
- UniswapV3Adapter (requires ISwapRouter address)
- UniswapV2Adapter (no constructor args)
- AggregatorRouter(owner, treasury)
- setAdapters on AggregatorRouter

Env vars (recommended):
- OWNER (default: first signer)
- TREASURY (required)
- V3_ROUTER (required for chain with Uniswap/Pancake V3)
*/

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId = Number((await ethers.provider.getNetwork()).chainId);
  const OWNER = process.env.OWNER || deployer.address;
  const TREASURY = process.env.TREASURY;
  let V3_ROUTER = process.env.V3_ROUTER; // e.g., 0xE592... (Uni/Pancake V3 per chain)
  let WETH = process.env.WETH; // e.g., WBNB on BSC

  if (!TREASURY) throw new Error("TREASURY env is required");
  if (!V3_ROUTER) throw new Error("V3_ROUTER env is required for UniswapV3Adapter");
  if (!WETH) throw new Error("WETH env is required for AggregatorRouter");
  // Normalize to lowercase to bypass strict checksum input requirement; ethers will use proper address on-chain
  V3_ROUTER = V3_ROUTER.toLowerCase();
  WETH = WETH.toLowerCase();

  console.log(`Deploying with ${deployer.address} on chain ${chainId}`);

  // Deploy adapters
  const V3Factory = await ethers.getContractFactory("UniswapV3Adapter");
  const v3 = await V3Factory.deploy(V3_ROUTER);
  await v3.waitForDeployment();
  console.log("UniswapV3Adapter:", await v3.getAddress());

  const V2Factory = await ethers.getContractFactory("UniswapV2Adapter");
  const v2 = await V2Factory.deploy();
  await v2.waitForDeployment();
  console.log("UniswapV2Adapter:", await v2.getAddress());

  // Deploy router
  const RouterFactory = await ethers.getContractFactory("AggregatorRouter");
  const router = await RouterFactory.deploy(OWNER, TREASURY, WETH);
  await router.waitForDeployment();
  console.log("AggregatorRouter:", await router.getAddress());

  // Configure adapters on router
  const tx = await router.setAdapters(await v3.getAddress(), await v2.getAddress());
  await tx.wait();
  console.log("Adapters set on AggregatorRouter");

  // Persist addresses
  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `aggregator.${chainId}.json`);
  const data = {
    chainId,
    deployer: deployer.address,
    owner: OWNER,
    treasury: TREASURY,
    contracts: {
      UniswapV3Adapter: await v3.getAddress(),
      UniswapV2Adapter: await v2.getAddress(),
      AggregatorRouter: await router.getAddress(),
    },
    network: network.name,
    timestamp: Date.now(),
  };
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  console.log("Saved:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
