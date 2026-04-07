import { PredictionMarket } from "../../typechain-types"
import { expect } from "chai"
import { getAddress, Signer } from "ethers"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { MarketState } from "../constants"

describe("Invalidate Market Tests.", function () {
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

    it("Should revert because invalidator is not creator nor resolver.", async function () {
        const fakeResolver = (await ethers.getSigners())[2]
        const marketInfo = await PredictionMarket.getMarketInfo()
        const creator = marketInfo[2]
        const resolver = marketInfo[3]
        await expect(PredictionMarket.connect(fakeResolver).invalidate())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_Unauthorized()")

        await assertMarketState(MarketState.OPEN)
        expect(await fakeResolver.getAddress()).to.not.equal(creator)
        expect(await fakeResolver.getAddress()).to.not.equal(resolver)
    })

    it("Should revert because market has been closed.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 4_000)

        const resolveTx = await PredictionMarket.connect(marketDeployer).forceClose()
        await resolveTx.wait()

        await expect(PredictionMarket.connect(marketDeployer).invalidate())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketClosed()")

        await assertMarketState(MarketState.CLOSED)

        await helpers.snapshot.restoreSnapshot()
    })

    it("Should revert because market has been resolved.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 4_000)

        const resolveTx = await PredictionMarket.connect(marketDeployer).resolve(true)
        await resolveTx.wait()

        await expect(PredictionMarket.connect(marketDeployer).invalidate())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketAlreadyResolved()")

        await assertMarketState(MarketState.RESOLVED)

        await helpers.snapshot.restoreSnapshot()
    })

    it("Should invalidate the market.", async function () {
        await PredictionMarket.connect(marketDeployer).invalidate()
        await assertMarketState(MarketState.INVALID)
    })

    async function assertMarketState(state: MarketState) {
        const marketInfo = await PredictionMarket.getMarketInfo()
        const marketState = marketInfo[6]
        expect(marketState).to.be.equal(state)
    }
})