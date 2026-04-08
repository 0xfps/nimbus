import { ZeroAddress } from "ethers"
import { ethers } from "hardhat"
import { PredictionMarketFactory, USDC } from "../../typechain-types"
import deployPredictionMarketFactory from "../boilerplate/deploy-factory"
import { expect } from "chai"
import { Signer } from "ethers"
import { dave, edgar, fisk } from "../constants"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ContractTransactionResponse } from "ethers"
import { END_TIME, NOW } from "../boilerplate/deploy-market"

describe("Create Binary Market Tests.", function () {
    let PredictionMarketFactory: PredictionMarketFactory,
        USDC: USDC,
        alice: Signer,
        bob: Signer,
        aliceAddress: string,
        bobAddress: string,
        tx: ContractTransactionResponse

    before(async function () {
        let { factory, usdc, deployer } = await deployPredictionMarketFactory()
        PredictionMarketFactory = factory
        USDC = usdc
        alice = deployer
        bob = (await ethers.getSigners())[1]
        aliceAddress = await alice.getAddress()
        bobAddress = await bob.getAddress()
    })

    const marketCreationData: MarketCreationDataStruct = {
        marketType: 0,
        creator: "",
        resolver: "",
        feeRecipient: edgar,
        platformFeeBps: 30,
        question: "Who's the best player in the world?",
        description: "Who, dead or alive is the best football player in the world?",
        category: 50,
        subcategory: 50,
        endTime: 0,
    }

    it("Should revert due to invalid end time.", async function () {
        marketCreationData.creator = aliceAddress
        marketCreationData.resolver = bobAddress
        marketCreationData.endTime = NOW - 1_600_000

        await expect(PredictionMarketFactory.connect(alice).createBinaryMarket(marketCreationData))
            .to.be.revertedWithCustomError(PredictionMarketFactory, "Nimbus_InvalidEndTime()")
    })

    it("Should revert due to invalid fee recipient.", async function () {
        marketCreationData.creator = aliceAddress
        marketCreationData.resolver = bobAddress
        marketCreationData.endTime = END_TIME
        marketCreationData.feeRecipient = ZeroAddress

        await expect(PredictionMarketFactory.connect(alice).createBinaryMarket(marketCreationData))
            .to.be.revertedWithCustomError(PredictionMarketFactory, "Nimbus_InvalidRecipient()")
    })

    it("Should revert due to invalid resolver.", async function () {
        marketCreationData.creator = aliceAddress
        marketCreationData.resolver = dave
        marketCreationData.endTime = END_TIME
        marketCreationData.feeRecipient = fisk

        await expect(PredictionMarketFactory.connect(alice).createBinaryMarket(marketCreationData))
            .to.be.revertedWithCustomError(PredictionMarketFactory, "Nimbus_ResolverNotApproved()")
    })

    it("Should create a valid market.", async function () {
        const oldMarketCount = await PredictionMarketFactory.allMarketsLength()

        marketCreationData.creator = aliceAddress
        marketCreationData.resolver = aliceAddress
        marketCreationData.endTime = END_TIME
        marketCreationData.feeRecipient = fisk

        tx = await PredictionMarketFactory.connect(alice).createBinaryMarket(marketCreationData)
        await tx.wait()

        const newMarketCount = await PredictionMarketFactory.allMarketsLength()

        tx = await PredictionMarketFactory.connect(alice).createBinaryMarket(marketCreationData)
        await tx.wait()

        const latestMarketCount = await PredictionMarketFactory.allMarketsLength()

        expect(newMarketCount).to.be.greaterThan(oldMarketCount)
        expect(latestMarketCount).to.be.greaterThan(newMarketCount)
        expect(latestMarketCount).to.be.greaterThan(oldMarketCount)
    })
})