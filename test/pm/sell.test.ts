import { PredictionMarket, USDC } from "../../typechain-types"
import { Signer } from "ethers"
import { expect } from "chai"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { mint } from "../boilerplate/mint"
import { addFeesAndReturnBalance, getFees, getRandomBoolean, MarketState, reduceTo6Decimals, takeFeesAndReturnBalance } from "../constants"

describe("Sell Tests.", function () {
    let PredictionMarket: PredictionMarket,
        marketData: MarketCreationDataStruct,
        marketDeployer: Signer,
        marketToken: string,
        buyer: Signer,
        buyerAddress: string,
        USDC: USDC

    const mintAmount = BigInt(500_000 * 1e6)
    let isYes = true
    let defaultShares = BigInt(18_000 * 1e18)
    let defaultMinReturn = BigInt(1 * 1e6) // USDC.

    beforeEach(async function () {
        const { market, deployer, marketCreationData, usdc } = await deployMarket()
        PredictionMarket = market
        marketData = marketCreationData
        marketDeployer = deployer
        marketToken = await usdc.getAddress()
        buyer = (await ethers.getSigners())[3]
        buyerAddress = await buyer.getAddress()
        USDC = usdc

        const marketAddress = await PredictionMarket.getAddress()
        await mint(usdc, buyerAddress, mintAmount)
        await usdc.connect(buyer).approve(marketAddress, mintAmount)
    })

    it("Should revert because market is not open.", async function () {
        await PredictionMarket.connect(marketDeployer).invalidate()
        await assertMarketState(MarketState.INVALID)

        await expect(PredictionMarket.connect(buyer).sell(isYes, defaultShares, defaultMinReturn))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketClosed()")
    })

    it("Should revert because market has gone beyond end time.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 5_000)

        // This shouldn't be, markets should automatically close.
        await assertMarketState(MarketState.OPEN)

        await expect(PredictionMarket.connect(buyer).sell(isYes, defaultShares, defaultMinReturn))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketClosed()")
        await helpers.snapshot.restoreSnapshot()
    })

    it("Should revert because of sale of 0.", async function () {
        await expect(PredictionMarket.connect(buyer).sell(isYes, 0, 0))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_InvalidAmount()")
    })

    it("Should revert because of insufficient amount.", async function () {
        await expect(PredictionMarket.connect(buyer).sell(isYes, defaultShares, defaultMinReturn))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_InsufficientAmount()")
    })

    it("Should revert due to deflated cost.", async function () {
        const direction = getRandomBoolean()

        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        const sharesToSell = BigInt(defaultShares / 2n)

        await expect(PredictionMarket.connect(buyer).sell(direction, sharesToSell, BigInt(1e18)))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_DeflatedCost()")
    })

    it("Should sell.", async function () {
        const direction = getRandomBoolean()

        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        const [oldXPrice, oldYPrice] = await PredictionMarket.getPriceFromReserves()
        const [oldYesBalance, oldNoBalance] = await PredictionMarket.getUserPosition(buyerAddress)
        const oldCollPool = await PredictionMarket.collateralPool()
        const oldXReserve = await PredictionMarket.xReserve()
        const oldYReserve = await PredictionMarket.yReserve()
        const oldUsdcBalance = await USDC.balanceOf(buyerAddress)
        const sharesToSell = BigInt(defaultShares / 2n)

        const sellTx = await PredictionMarket.connect(buyer).sell(direction, sharesToSell, defaultMinReturn)
        await sellTx.wait()

        const [newXPrice, newYPrice] = await PredictionMarket.getPriceFromReserves()
        const [newYesBalance, newNoBalance] = await PredictionMarket.getUserPosition(buyerAddress)
        const newXReserve = await PredictionMarket.xReserve()
        const newYReserve = await PredictionMarket.yReserve()
        const newCollPool = await PredictionMarket.collateralPool()
        const newUsdcBalance = await USDC.balanceOf(buyerAddress)

        if (direction) {
            expect(newYesBalance).to.be.lessThan(oldYesBalance)
            expect(newNoBalance).to.be.equal(oldNoBalance)
            expect(newXReserve).to.be.greaterThan(oldXReserve)
            expect(newYReserve).to.be.lessThan(oldYReserve)
            expect(newXPrice).to.be.lessThan(oldXPrice)
            expect(newYPrice).to.be.greaterThan(oldYPrice)
        } else {
            expect(newYesBalance).to.be.equal(oldYesBalance)
            expect(newNoBalance).to.be.lessThan(oldNoBalance)
            expect(newXReserve).to.be.lessThan(oldXReserve)
            expect(newYReserve).to.be.greaterThan(oldYReserve)
            expect(newXPrice).to.be.greaterThan(oldXPrice)
            expect(newYPrice).to.be.lessThan(oldYPrice)
        }
        
        expect(newCollPool).to.be.lessThan(oldCollPool)
        expect(newUsdcBalance).to.be.greaterThan(oldUsdcBalance)
    })

    async function assertMarketState(state: MarketState) {
        const marketInfo = await PredictionMarket.getMarketInfo()
        const marketState = marketInfo[6]
        expect(marketState).to.be.equal(state)
    }
})