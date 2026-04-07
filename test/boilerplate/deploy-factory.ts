import { Signer } from "ethers";
import { PredictionMarketFactory, USDC } from "../../typechain-types";
import { ethers } from "hardhat"

export interface FactoryData {
    factory: PredictionMarketFactory,
    usdc: USDC,
    deployer: Signer
}

export default async function deployPredictionMarketFactory(): Promise<FactoryData> {
    const [alice] = await ethers.getSigners()
    const USDC = await ethers.deployContract("USDC")
    const usdcAddress = await USDC.getAddress()
    const PredictionMarketFactory = await ethers.deployContract("PredictionMarketFactory", [
        usdcAddress,
        await alice.getAddress()
    ])

    return {
        factory: PredictionMarketFactory,
        usdc: USDC,
        deployer: alice
    }
}