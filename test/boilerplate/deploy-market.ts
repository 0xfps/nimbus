import { PredictionMarket } from "../../typechain-types";
import { getAddress, Signer } from "ethers";
import { PredictionMarketFactory, USDC } from "../../typechain-types";
import { ethers, helpers } from "hardhat"
import deployPredictionMarketFactory, { FactoryData } from "./deploy-factory";
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory";
import { edgar } from "../constants";

interface MarketData extends FactoryData {
    market: PredictionMarket
    marketCreationData: MarketCreationDataStruct
}

export const NOW = Number(BigInt(new Date().getTime()) / BigInt(1000))
export const TWO_WEEKS = (60 * 60 * 24 * 14)
export const END_TIME = NOW + TWO_WEEKS

export default async function deployMarket(): Promise<MarketData> {
    const { factory, usdc, deployer } = await deployPredictionMarketFactory()

    const marketCreationData: MarketCreationDataStruct = {
        marketType: 0,
        creator: await deployer.getAddress(),
        resolver: await deployer.getAddress(),
        feeRecipient: await deployer.getAddress(),
        platformFeeBps: 30,
        question: "Messi vs Ronaldo?",
        description: "Who, dead or alive is the best football player in the world?",
        category: 50,
        subcategory: 50,
        endTime: END_TIME,
    }

    const deployTx = await factory.connect(deployer).createBinaryMarket(marketCreationData)
    const deployReceipt = await deployTx.wait()
    let deployedMarket: string, market: PredictionMarket

    if (deployReceipt?.logs) {
        deployedMarket = `0x${deployReceipt.logs[0].topics[1].slice(-40)}`
        market = await ethers.getContractAt("PredictionMarket", deployedMarket)
    }

    return { factory, usdc, deployer, market: market!, marketCreationData }
}