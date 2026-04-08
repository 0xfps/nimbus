import { PredictionMarket, USDC } from "../../typechain-types"
import { Signer } from "ethers"
import { expect } from "chai"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { mint } from "../boilerplate/mint"
import { addFeesAndReturnBalance, edgar, getFees, getRandomBoolean, MarketState, reduceTo6Decimals, takeFeesAndReturnBalance } from "../constants"

describe("Refund Tests.", function () {
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

    it("Should revert because market is not invalid.", async function () {
        await expect(PredictionMarket.connect(buyer).claimRefund())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketNotInvalid()")
    })

    it("Should revert because user balances are 0.", async function () {
        await PredictionMarket.connect(marketDeployer).invalidate()
        await expect(PredictionMarket.connect(buyer).claimRefund())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_NoWinnings()")
    })

    it("Should revert because of already claim refund.", async function () {
        const direction = getRandomBoolean()
        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        await PredictionMarket.connect(marketDeployer).invalidate()

        const oldBal = await USDC.balanceOf(buyerAddress)
        let hasClaimed = await PredictionMarket.hasClaimed(buyerAddress)
        expect(hasClaimed).to.be.equal(false)

        await PredictionMarket.connect(buyer).claimRefund()

        hasClaimed = await PredictionMarket.hasClaimed(buyerAddress)
        expect(hasClaimed).to.be.equal(true)

        await expect(PredictionMarket.connect(buyer).claimRefund())
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_AlreadyClaimed()")

        const newBal = await USDC.balanceOf(buyerAddress)
        expect(newBal).to.be.greaterThan(oldBal)
    })

    it("Should claim refund.", async function () {
        const direction = getRandomBoolean()
        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        await PredictionMarket.connect(marketDeployer).invalidate()

        const oldBal = await USDC.balanceOf(buyerAddress)
        let hasClaimed = await PredictionMarket.hasClaimed(buyerAddress)
        expect(hasClaimed).to.be.equal(false)

        await PredictionMarket.connect(buyer).claimRefund()

        hasClaimed = await PredictionMarket.hasClaimed(buyerAddress)
        expect(hasClaimed).to.be.equal(true)

        const newBal = await USDC.balanceOf(buyerAddress)
        expect(newBal).to.be.greaterThan(oldBal)
    })
})