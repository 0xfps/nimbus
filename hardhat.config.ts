import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-foundry";
import dotenv from "dotenv"
import "@keep-network/hardhat-helpers"

dotenv.config()

const PRIVATE_KEY = process.env.PRIVATE_KEY!
const ACCOUNTS_CONFIG = {
  accounts: [PRIVATE_KEY],
  allowUnlimitedContractSize: true
}

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1
      }
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY!
  },
  networks: {
    hardhat: {
      forking: {
        enabled: true,
        url: "https://arbitrum-sepolia.gateway.tenderly.co"
      }
    },
    arbitrumSepolia: {
      chainId: 421614,
      url: "https://arbitrum-sepolia.gateway.tenderly.co",
      ...ACCOUNTS_CONFIG
    }
  },
  mocha: {
    timeout: 0
  }
};

export default config;
