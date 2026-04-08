import { PredictionMarket } from "../../typechain-types"
import { Signer } from "ethers"
import deployMarket from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"

describe("Sell Quote Tests.", function () {
    let PredictionMarket: PredictionMarket,
        marketData: MarketCreationDataStruct,
        marketDeployer: Signer,
        marketToken: string

    const shares = BigInt(18_000 * 1e18)

    beforeEach(async function () {
        const { market, deployer, marketCreationData, usdc } = await deployMarket()
        PredictionMarket = market
        marketData = marketCreationData
        marketDeployer = deployer
        marketToken = await usdc.getAddress()
    })

    it("Analyze sell quote.", async function () {
        await PredictionMarket.getSellQuote(true, shares)
        await PredictionMarket.getSellQuote(false, shares)
    })
})