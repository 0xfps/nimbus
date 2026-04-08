import { PredictionMarket } from "../../typechain-types"
import { expect } from "chai"
import { getAddress, Signer } from "ethers"
import deployMarket, { END_TIME } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import pmAmm from "@0xfps/pmamm-js"

describe("Prediction Market Deployment Tests.", function () {
    let PredictionMarket: PredictionMarket,
        marketData: MarketCreationDataStruct,
        marketDeployer: Signer,
        marketToken: string

    beforeEach(async function () {
        const { market, deployer, marketCreationData, usdc } = await deployMarket()
        PredictionMarket = market
        marketData = marketCreationData
        marketDeployer = deployer
        marketToken = await usdc.getAddress()
    })

    it("Should use USDC as token.", async function () {
        const token = await PredictionMarket.TOKEN()
        expect(getAddress(token)).to.be.equal(marketToken)
    })

    it("Should get market info.", async function () {
        const marketInfo = await PredictionMarket.getMarketInfo()

        const creator = marketInfo[2]
        const [xPrice, yPrice] = marketInfo[8]

        expect(creator).to.be.equal(await marketDeployer.getAddress())
        expect(xPrice).to.be.equal(yPrice)
    })

    it("Should get an equal Liquidity Factor.", async function () {
        const lf = await PredictionMarket.getEffectiveLiquidity()
        const currentTime = parseInt((new Date().getTime() / 1000).toFixed(0))
        const localLf = pmAmm.getEffectiveLiquidity({
            startTime: 0, // Unneeded.
            currentTime,
            endTime: Number(END_TIME)
        })

        expect(Number(lf)).to.be.equal(localLf)
    })

    it("Should get equal prices.", async function () {
        const prices = await PredictionMarket.getPriceFromReserves()
        const [xPrice, yPrice] = prices

        expect(xPrice).to.be.equal(yPrice)
    })
})