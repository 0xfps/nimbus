import { PredictionMarket } from "../../typechain-types"
import { expect } from "chai"
import { getAddress, Signer } from "ethers"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { MarketState } from "../constants"

describe("Resolve Market Tests.", function () {
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

    it("Should revert because resolver is not resolver.", async function () {
        const fakeResolver = (await ethers.getSigners())[2]
        const marketInfo = await PredictionMarket.getMarketInfo()
        const creator = marketInfo[2]
        const resolver = marketInfo[3]
        await expect(PredictionMarket.connect(fakeResolver).resolve(true))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_Unauthorized()")

        await assertMarketState(MarketState.OPEN)
        expect(await fakeResolver.getAddress()).to.not.equal(creator)
        expect(await fakeResolver.getAddress()).to.not.equal(resolver)
    })

    it("Should revert because time is too early.", async function () {
        await expect(PredictionMarket.connect(marketDeployer).resolve(true))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_TooEarly()")

        await assertMarketState(MarketState.OPEN)
    })

    it("Should revert because market has been resolved.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 4_000)

        const _resolution = true
        const resolveTx = await PredictionMarket.connect(marketDeployer).resolve(_resolution)
        await resolveTx.wait()

        await expect(PredictionMarket.connect(marketDeployer).resolve(false))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketAlreadyResolved()")

        const resolution = await PredictionMarket.outcome()
        await assertMarketState(MarketState.RESOLVED)
        expect(resolution).to.be.equal(_resolution)

        await helpers.snapshot.restoreSnapshot()
    })

    it("Should revert because market has been invalidated.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 4_000)
        const invalidateTx = await PredictionMarket.connect(marketDeployer).invalidate()
        await invalidateTx.wait()

        await expect(PredictionMarket.connect(marketDeployer).resolve(false))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketInvalid()")

        await assertMarketState(MarketState.INVALID)
        await helpers.snapshot.restoreSnapshot()
    })

    it("Should resolve market.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 4_000)

        const _resolution = true
        const resolveTx = await PredictionMarket.connect(marketDeployer).resolve(_resolution)
        await resolveTx.wait()

        const resolution = await PredictionMarket.outcome()
        const resolutionTime = await PredictionMarket.resolutionTime()
        await assertMarketState(MarketState.RESOLVED)

        expect(resolution).to.be.equal(_resolution)
        expect(resolutionTime).to.not.equal(0) // Has been set.

        await helpers.snapshot.restoreSnapshot()
    })

    async function assertMarketState(state: MarketState) {
        const marketInfo = await PredictionMarket.getMarketInfo()
        const marketState = marketInfo[6]
        expect(marketState).to.be.equal(state)
    }
})