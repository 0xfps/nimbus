import { ZeroAddress } from "ethers"
import { ethers } from "hardhat"
import { PredictionMarketFactory, USDC } from "../../typechain-types"
import deployPredictionMarketFactory from "../boilerplate/deploy-factory"
import { expect } from "chai"
import { Signer } from "ethers"
import { fisk } from "../constants"
import { ContractTransactionResponse } from "ethers"

describe("Approve And Revoke Resolver Tests.", function () {
    let PredictionMarketFactory: PredictionMarketFactory, USDC: USDC, alice: Signer, bob: Signer
    let tx: ContractTransactionResponse

    before(async function () {
        let { factory, usdc, deployer } = await deployPredictionMarketFactory()
        PredictionMarketFactory = factory
        USDC = usdc
        alice = deployer
        bob = (await ethers.getSigners())[1]
    })

    it("Should show valid addresses and have deployer already approved.", async function () {
        const pmfAddress = await PredictionMarketFactory.getAddress()
        const usdc = await USDC.getAddress()

        expect(pmfAddress).to.not.equal(ZeroAddress)
        expect(usdc).to.not.equal(ZeroAddress)

        const deployer = await alice.getAddress()
        const isResolver = await PredictionMarketFactory.approvedResolvers(deployer)
        expect(isResolver).to.be.equal(true)
    })

    it("Should approve a new resolver.", async function () {
        let isResolver = await PredictionMarketFactory.approvedResolvers(fisk)
        expect(isResolver).to.be.equal(false)

        tx = await PredictionMarketFactory.connect(alice).approveResolver(fisk)
        await tx.wait()

        isResolver = await PredictionMarketFactory.approvedResolvers(fisk)
        expect(isResolver).to.be.equal(true)
    })

    it("Should not approve a new resolver by non owner.", async function () {
        const bobAddress = await bob.getAddress()
        let isResolver = await PredictionMarketFactory.approvedResolvers(bobAddress)
        expect(isResolver).to.be.equal(false)

        await expect(PredictionMarketFactory.connect(bob).approveResolver(bobAddress))
            .to.revertedWithCustomError(PredictionMarketFactory, "Nimbus_Unauthorized()")

        isResolver = await PredictionMarketFactory.approvedResolvers(bobAddress)
        expect(isResolver).to.be.equal(false)
    })

    it("Should revoke a resolver.", async function () {
        tx = await PredictionMarketFactory.connect(alice).revokeResolver(fisk)
        await tx.wait()

        const isResolver = await PredictionMarketFactory.approvedResolvers(fisk)
        expect(isResolver).to.be.equal(false)
    })

    it("Should not revoke a new resolver by non owner.", async function () {
        const bobAddress = await bob.getAddress()
        let isResolver = await PredictionMarketFactory.approvedResolvers(bobAddress)
        expect(isResolver).to.be.equal(false)

        await expect(PredictionMarketFactory.connect(bob).revokeResolver(bobAddress))
            .to.revertedWithCustomError(PredictionMarketFactory, "Nimbus_Unauthorized()")

        isResolver = await PredictionMarketFactory.approvedResolvers(bobAddress)
        expect(isResolver).to.be.equal(false)
    })
})