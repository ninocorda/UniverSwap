import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@typechain/hardhat';
import 'dotenv/config';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v6',
  },
  networks: {
    // BSC Testnet
    bscTestnet: {
      url: process.env.BSC_TESTNET_RPC || '',
      chainId: 97,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    // BSC Mainnet
    bsc: {
      url: process.env.BSC_MAINNET_RPC || '',
      chainId: 56,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  etherscan: {
  apiKey: process.env.BSCSCAN_API_KEY || '',
  customChains: [
    {
      network: 'bscTestnet',
      chainId: 97,
      urls: {
        apiURL: 'https://api-testnet.bscscan.com/api',
        browserURL: 'https://testnet.bscscan.com',
      },
    },
  ],
},
sourcify: {
  enabled: false,
},
};

export default config;
