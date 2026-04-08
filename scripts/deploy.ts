import { writeToSetDirectory } from "./write"
import { ethers, run, network } from "hardhat"
import dotenv from "dotenv"

dotenv.config()
const { PRIVATE_KEY } = process.env

async function deploy() {
    if (!PRIVATE_KEY) throw new Error("No Private Key Set!")

    // Deployments only to Arbitrum Sepolia.
    const deploymentData: any = {}
    const CONFIRMATION_BLOCKS = 5

    const id = network.config.chainId
    const owner = new ethers.Wallet(PRIVATE_KEY).address

    const USDC = await ethers.deployContract("USDC")
    await USDC.deploymentTransaction()?.wait(CONFIRMATION_BLOCKS)
    const usdcAddress = await USDC.getAddress()

    await run("verify:verify", {
        address: usdcAddress,
        constructorArguments: []
    })

    const PredictionMarketFactory = await ethers.deployContract("PredictionMarketFactory", [
        usdcAddress,
        owner
    ])
    await PredictionMarketFactory.deploymentTransaction()?.wait(CONFIRMATION_BLOCKS)
    const predictionMarketFactoryAddress = await PredictionMarketFactory.getAddress()

    await run("verify:verify", {
        address: predictionMarketFactoryAddress,
        constructorArguments: [usdcAddress, owner]
    })

    deploymentData[id!] = {
        ...deploymentData[id!],
        chainId: id,
        usdc: usdcAddress,
        factory: predictionMarketFactoryAddress
    }

    writeToSetDirectory("arbitrum-sepolia", JSON.stringify(deploymentData))
}


deploy()