import { ethers } from "hardhat";

async function main() {
  const contract = await ethers.deployContract("ERC20Template");
  await contract.waitForDeployment();

  console.log(`ERC20Template deployed at: ${contract.target}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
