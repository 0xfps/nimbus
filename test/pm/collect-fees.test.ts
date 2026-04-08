import { PredictionMarket, USDC } from "../../typechain-types"
import { Signer } from "ethers"
import { expect } from "chai"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { mint } from "../boilerplate/mint"
import { addFeesAndReturnBalance, edgar, getFees, getRandomBoolean, MarketState, reduceTo6Decimals, takeFeesAndReturnBalance } from "../constants"

describe("Collect Fee Tests.", function () {
    let PredictionMarket: PredictionMarket,
        marketData: MarketCreationDataStruct,
        marketDeployer: Signer,
        marketToken: string,
        buyer: Signer,
        buyerAddress: string,
        USDC: USDC,
        ed: Signer

    const mintAmount = BigInt(500_000 * 1e6)
    let isYes = true
    let defaultShares = BigInt(18_000 * 1e18)
    let defaultAmount = BigInt(10_000 * 1e18)

    beforeEach(async function () {
        const { market, deployer, marketCreationData, usdc } = await deployMarket()
        PredictionMarket = market
        marketData = marketCreationData
        marketDeployer = deployer
        marketToken = await usdc.getAddress()
        buyer = (await ethers.getSigners())[3]
        buyerAddress = await buyer.getAddress()
        USDC = usdc
        ed = await ethers.getSigner(edgar)

        const marketAddress = await PredictionMarket.getAddress()
        await mint(usdc, buyerAddress, mintAmount)
        await usdc.connect(buyer).approve(marketAddress, mintAmount)
    })

    it("Should revert because caller is not fee recipient.", async function () {
        await expect(PredictionMarket.connect(buyer).collectFees())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_Unauthorized()")
    })

    it("Should revert because accumulated fees is 0.", async function () {
        await expect(PredictionMarket.connect(marketDeployer).collectFees())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_NoFees()")
    })

    it("Should collect fees.", async function () {
        const oldAliceBalance = await USDC.balanceOf(await marketDeployer.getAddress())
        const direction = getRandomBoolean()
        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        const accumulatedFees = await PredictionMarket.accumulatedFees()

        const collectFeeTx = await PredictionMarket.connect(marketDeployer).collectFees()
        await collectFeeTx.wait()

        const newAliceBalance = await USDC.balanceOf(await marketDeployer.getAddress())

        expect(newAliceBalance).to.be.greaterThan(oldAliceBalance)
        expect(newAliceBalance - oldAliceBalance).to.be.equal(accumulatedFees)
    })
})