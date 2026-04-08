import { PredictionMarket, USDC } from "../../typechain-types"
import { Signer } from "ethers"
import { expect } from "chai"
import deployMarket, { TWO_WEEKS } from "../boilerplate/deploy-market"
import { MarketCreationDataStruct } from "../../typechain-types/IPredictionMarketFactory"
import { ethers, helpers } from "hardhat"
import { mint } from "../boilerplate/mint"
import { addFeesAndReturnBalance, getFees, getRandomBoolean, MarketState, reduceTo6Decimals, takeFeesAndReturnBalance } from "../constants"

describe("Buy Tests.", function () {
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

        const marketAddress = await PredictionMarket.getAddress()
        await mint(usdc, buyerAddress, mintAmount)
        await usdc.connect(buyer).approve(marketAddress, mintAmount)
    })

    it("Should revert because market is not open.", async function () {
        await PredictionMarket.connect(marketDeployer).invalidate()
        await assertMarketState(MarketState.INVALID)

        await expect(PredictionMarket.connect(buyer).buy(isYes, defaultAmount, defaultShares))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketClosed()")
    })

    it("Should revert because market has gone beyond end time.", async function () {
        await helpers.snapshot.createSnapshot()
        await helpers.time.increaseTime(TWO_WEEKS + 5_000)

        // This shouldn't be, markets should automatically close.
        await assertMarketState(MarketState.OPEN)

        await expect(PredictionMarket.connect(buyer).buy(isYes, defaultAmount, defaultShares))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_MarketClosed()")
        await helpers.snapshot.restoreSnapshot()
    })

    it("Should revert because of inflated cost.", async function () {
        const direction = getRandomBoolean()
        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = takeFeesAndReturnBalance(amountInUsdc)

        await expect(PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares))
            .to.be.revertedWithCustomError(PredictionMarket, "Nimbus_InflatedCost()")
    })

    it("Should buy.", async function () {
        const direction = getRandomBoolean()
        
        const oldXReserve = await PredictionMarket.xReserve()
        const oldYReserve = await PredictionMarket.yReserve()
        const oldCollPool = await PredictionMarket.collateralPool()
        const oldAccFees = await PredictionMarket.accumulatedFees()
        const [oldYesBalance, oldNoBalance] = await PredictionMarket.getUserPosition(buyerAddress)

        const prices = await PredictionMarket.getPriceFromReserves()
        const xPrice = Number(prices[0]) / 1e18
        const yPrice = Number(prices[1]) / 1e18

        const amountIn18Decimals = direction ? Number(defaultShares) * xPrice : Number(defaultShares) * yPrice
        const amountInUsdc = reduceTo6Decimals(BigInt(amountIn18Decimals))
        const costOfPurchase = addFeesAndReturnBalance(amountInUsdc)

        const buyTx = await PredictionMarket.connect(buyer).buy(direction, costOfPurchase, defaultShares)
        await buyTx.wait()

        const newXReserve = await PredictionMarket.xReserve()
        const newYReserve = await PredictionMarket.yReserve()
        const newCollPool = await PredictionMarket.collateralPool()
        const newAccFees = await PredictionMarket.accumulatedFees()
        const [newXPrice, newYPrice] = await PredictionMarket.getPriceFromReserves()
        const [newYesBalance, newNoBalance] = await PredictionMarket.getUserPosition(buyerAddress)

        if (direction) {
            expect(newXReserve).to.be.lessThan(oldXReserve)
            expect(newYReserve).to.be.greaterThan(oldYReserve)
            expect(newXPrice).to.be.greaterThan(prices[0])
            expect(newYPrice).to.be.lessThan(prices[1])
            expect(newYesBalance).to.be.greaterThan(oldYesBalance)
            expect(newYesBalance - oldYesBalance).to.be.equal(defaultShares)
            expect(newNoBalance).to.be.equal(oldNoBalance)
        } else {
            expect(newXReserve).to.be.greaterThan(oldXReserve)
            expect(newYReserve).to.be.lessThan(oldYReserve)
            expect(newXPrice).to.be.lessThan(prices[0])
            expect(newYPrice).to.be.greaterThan(prices[1])
            expect(newNoBalance).to.be.greaterThan(oldNoBalance)
            expect(newNoBalance - oldNoBalance).to.be.equal(defaultShares)
            expect(newYesBalance).to.be.equal(oldYesBalance)
        }

        expect(newCollPool).to.be.greaterThan(oldCollPool)
        expect(newAccFees).to.be.greaterThan(oldAccFees)
    })

    async function assertMarketState(state: MarketState) {
        const marketInfo = await PredictionMarket.getMarketInfo()
        const marketState = marketInfo[6]
        expect(marketState).to.be.equal(state)
    }
})