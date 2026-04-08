import { PredictionMarket } from "../../typechain-types"
import { expect } from "chai"
import { Signer } from "ethers"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { helpers } from "hardhat"
import { MarketState } from "../constants"

describe("Force Close Tests.", function () {
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

    it("Should revert due to being too early.", async function () {
        await expect(PredictionMarket.connect(marketDeployer).forceClose())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_TooEarly()")


        assertMarketState(MarketState.OPEN)
    })

    it("Should revert due to being not open, i.e. resolved.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 3_000)

        const resolveTx = await PredictionMarket.connect(marketDeployer).resolve(true)
        await resolveTx.wait()

        await expect(PredictionMarket.connect(marketDeployer).forceClose())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_NotOpen()")

        assertMarketState(MarketState.RESOLVED)
        // Revert to last taken snapshot because hardhat fucking applies the time to everything.
        await helpers.snapshot.restoreSnapshot()
    })

    it("Should close market.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 3_000)
        const closeTx = await PredictionMarket.connect(marketDeployer).forceClose()
        await closeTx.wait()

        assertMarketState(MarketState.CLOSED)
        // Revert to last taken snapshot because hardhat fucking applies the time to everything.
        await helpers.snapshot.restoreSnapshot()
    })

    async function assertMarketState(state: MarketState) {
        const marketInfo = await PredictionMarket.getMarketInfo()
        const marketState = marketInfo[6]
        expect(marketState).to.be.equal(state)
    }
})