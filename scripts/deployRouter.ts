import { ethers } from "hardhat";

async function main() {
  const owner = "0x7afa70D45bD844283337dab245a9E33f11961336"; // TODO: reemplaza con tu address en BSC testnet
  const allowedRouters = [
    "0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3" // PancakeSwap V2 router en BSC testnet
    // Agrega aquí más routers si lo necesitas
  ];

  const Router = await ethers.getContractFactory("AggregatorRouter");
  const router = await Router.deploy(owner, allowedRouters);
  await router.waitForDeployment();

  const deployedAddress = await router.getAddress();
  console.log("AggregatorRouter deployed at:", deployedAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
