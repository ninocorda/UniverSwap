import { ethers, network } from 'hardhat';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying IDOFactory with ${deployer.address} on chain ${network.config.chainId}`);

  const Factory = await ethers.getContractFactory('IDOFactory');
  const factory = await Factory.deploy();
  await factory.waitForDeployment();
  const address = await factory.getAddress();

  console.log(`IDOFactory: ${address}`);

  // Save deployment artifact path similar to aggregator
  const outDir = join(__dirname, '..', 'deployments');
  try { mkdirSync(outDir, { recursive: true }); } catch {}
  const outPath = join(outDir, `ido_factory.${network.config.chainId}.json`);
  writeFileSync(outPath, JSON.stringify({ chainId: network.config.chainId, address }, null, 2));
  console.log(`Saved: ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
