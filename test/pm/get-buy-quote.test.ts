import { PredictionMarket } from "../../typechain-types"
import { Signer } from "ethers"
import deployMarket from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"

describe("Buy Quote Tests.", function () {
    let PredictionMarket: PredictionMarket,
        marketData: MarketCreationDataStruct,
        marketDeployer: Signer,
        marketToken: string

    const usdcPrice = 10_000 * 1e6

    beforeEach(async function () {
        const { market, deployer, marketCreationData, usdc } = await deployMarket()
        PredictionMarket = market
        marketData = marketCreationData
        marketDeployer = deployer
        marketToken = await usdc.getAddress()
    })

    it("Analyze buy quote.", async function () {
        await PredictionMarket.getBuyQuote(true, usdcPrice)
        await PredictionMarket.getBuyQuote(false, usdcPrice)
    })
})