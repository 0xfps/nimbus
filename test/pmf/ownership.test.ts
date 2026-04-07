import { ethers } from "hardhat"
import { PredictionMarketFactory, USDC } from "../../typechain-types"
import deployPredictionMarketFactory from "../boilerplate/deploy-factory"
import { expect } from "chai"
import { Signer } from "ethers"
import { ContractTransactionResponse } from "ethers"

describe("Ownership Transfer Tests.", function () {
    let PredictionMarketFactory: PredictionMarketFactory,
        USDC: USDC,
        alice: Signer,
        bob: Signer,
        tx: ContractTransactionResponse

    before(async function () {
        let { factory, usdc, deployer } = await deployPredictionMarketFactory()
        PredictionMarketFactory = factory
        USDC = usdc
        alice = deployer
        bob = (await ethers.getSigners())[1]
    })

    it("Should not transfer ownership by non owner.", async function () {
        const bobAddress = await bob.getAddress()
        let owner = await PredictionMarketFactory.owner()
        expect(owner).to.be.equal(await alice.getAddress())

        await expect(PredictionMarketFactory.connect(bob).transferOwnership(bobAddress))
            .to.revertedWithCustomError(PredictionMarketFactory, "Nimbus_Unauthorized()")

        owner = await PredictionMarketFactory.owner()
        expect(owner).to.be.equal(await alice.getAddress())
    })

    it("Should transfer ownership by owner.", async function () {
        const bobAddress = await bob.getAddress()
        let owner = await PredictionMarketFactory.owner()
        expect(owner).to.be.equal(await alice.getAddress())

        tx = await PredictionMarketFactory.connect(alice).transferOwnership(bobAddress)
        await tx.wait()

        owner = await PredictionMarketFactory.owner()
        expect(owner).to.be.equal(bobAddress)
    })
})