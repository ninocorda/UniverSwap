import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox"; // incluye ethers, waffle, etc.
import * as dotenv from "dotenv";
import "ts-node/register";

dotenv.config();

// Configuración de Hardhat
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20", // ajusta según tus contratos
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {}, // red local por defecto
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 97, // BSC Testnet chain ID
    },
    // Puedes agregar otras redes aquí (BSC mainnet, etc.)
  },
  etherscan: {
    apiKey: process.env.BSCSCAN_API_KEY || "",
  },
};

export default config;
