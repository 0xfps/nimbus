// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;


import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IPredictionMarket } from "./interfaces/IPredictionMarket.sol";

import { MathLib } from "./lib/MathLib.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MarketCreationData, MarketState } from "./utils/Market.sol";
import { PMAMM } from "./PMAMM.sol";
import { Prices } from "./utils/Market.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @notice Individual binary prediction market with AMM-based trading
 * @dev Uses constant product AMM for price discovery and liquidity
 */
contract PredictionMarket is IPredictionMarket, ReentrancyGuard, PMAMM {
    using MathLib for uint256;
    using SafeERC20 for IERC20;
    
    uint16 public constant PRESET_LIQUIDITY_FACTOR = 10000;
    uint8 public constant NORMALIZER_DECIMAL = 18;
    uint16 public constant PLATFORM_FEE_BPS = 10;
    uint16 public constant TRADING_FEE_BPS = 30;

    IERC20 public immutable TOKEN; // Collateral. Trading token. USDC.
    address public immutable CREATOR;
    address public immutable RESOLVER;
    address public immutable FEE_RECIPIENT;

    uint64 public immutable RESOLUTION_TIME;

    MarketState public state;

    string public question;
    string public description;
    bool public outcome;

    uint256 public collateralPool;

    uint256 public yesShares;
    uint256 public noShares;

    uint256 public accumulatedFees;

    mapping(address => UserPosition) public userPosition;
    mapping(address => bool) public hasClaimed;

    receive() external payable {}

    constructor(address token, MarketCreationData memory marketCreationData)
    PMAMM (PRESET_LIQUIDITY_FACTOR, marketCreationData.endTime) {
        require(marketCreationData.endTime > block.timestamp, "Invalid end time");
        require(marketCreationData.creator != address(0), "Invalid creator");
        require(marketCreationData.resolver != address(0), "Invalid resolver");
        require(marketCreationData.feeRecipient != address(0), "Invalid fee recipient");
        
        TOKEN = IERC20(token);

        question = marketCreationData.question;
        description = marketCreationData.description;
        CREATOR = marketCreationData.creator;
        RESOLVER = marketCreationData.resolver;
        FEE_RECIPIENT = marketCreationData.feeRecipient;
    }

    // Amount is coming in, USDC maybe, if yes you're buying yes, else buying no.
    function buy(bool isYes, uint256 amount, uint256 shares) external nonReentrant {
        require(state == MarketState.OPEN, Nimbus_MarketClosed());
        require(block.timestamp < END_TIME, Nimbus_MarketClosed());
        require(xReserve > 0 && yReserve > 0, Nimbus_InsufficientLiquidity());

        TOKEN.safeTransferFrom(msg.sender, address(this), amount);

        Prices memory newPrices;
        int256 currentPrice;
        int256 newPrice;
        int256 newReserve;

        if (isYes) {
            currentPrice = getPriceFromReserves().yesPrice;
            userPosition[msg.sender].yesBalance += shares;
            newReserve = tradeX(true, int256(shares));
            yesShares += shares;
            newPrices = getPriceFromReserves();
            newPrice = newPrices.yesPrice;
        } else {
            currentPrice = getPriceFromReserves().noPrice;
            userPosition[msg.sender].noBalance += shares;
            newReserve = tradeY(true, int256(shares));
            noShares += shares;
            newPrices = getPriceFromReserves();
            newPrice = newPrices.noPrice;
        }

        int256 cost = ((currentPrice + newPrice) * int256(shares)) / 2e18;
        uint256 costInUsdc = _normalizeAmountToDefaultDecimals(uint256(cost));

        if (costInUsdc > amount) revert("Nimbus_InflatedCost.");
        
        uint256 balance = amount - costInUsdc;

        uint256 platformFee = (costInUsdc * PLATFORM_FEE_BPS) / 100;
        accumulatedFees += platformFee;

        uint256 tradingAmount = costInUsdc - platformFee;
        collateralPool += tradingAmount;

        TOKEN.safeTransferFrom(address(this), msg.sender, balance);

        emit Trade(msg.sender, isYes, true, shares, uint256(cost), newPrices);
    }

    function sell(
        bool isYes,
        uint256 shares,
        uint256 minReturn,
        address receiver
    ) external {
        require(state == MarketState.OPEN, Nimbus_MarketClosed());
        require(block.timestamp < END_TIME, Nimbus_MarketClosed());
        require(shares > 0, Nimbus_InvalidAmount());
        
        uint256 userBalance = isYes ? userPosition[msg.sender].yesBalance : userPosition[msg.sender].noBalance;
        require(userBalance > shares, "Insufficient shares");

        Prices memory newPrices;
        int256 currentPrice;
        int256 newPrice;
        int256 newReserve;

        if (isYes) {
            currentPrice = getPriceFromReserves().yesPrice;
            userPosition[msg.sender].yesBalance -= shares;
            newReserve = tradeX(false, int256(shares));
            yesShares -= shares;
            newPrices = getPriceFromReserves();
            newPrice = newPrices.yesPrice;
        } else {
            currentPrice = getPriceFromReserves().noPrice;
            userPosition[msg.sender].noBalance -= shares;
            newReserve = tradeY(false, int256(shares));
            noShares -= shares;
            newPrices = getPriceFromReserves();
            newPrice = newPrices.noPrice;
        }

        int256 cost = ((currentPrice + newPrice) * int256(shares)) / 2e18;
        uint256 costInUsdc = _normalizeAmountTo18Decimals(uint256(cost));

        if (costInUsdc > minReturn) revert("Nimbus_InflatedCost.");

        collateralPool -= costInUsdc;

        TOKEN.safeTransferFrom(address(this), receiver, costInUsdc);

        emit Trade(msg.sender, isYes, false, shares, uint256(cost), newPrices);
    }

    function resolve(bool _outcome) external {
        require(msg.sender == RESOLVER, Nimbus_Unauthorized());
        require(block.timestamp >= RESOLUTION_TIME, Nimbus_TooEarly());
        require(state == MarketState.CLOSED || state == MarketState.OPEN, Nimbus_MarketAlreadyResolved());
        
        outcome = _outcome;
        state = MarketState.RESOLVED;
        
        emit MarketResolved(_outcome, block.timestamp);
    }

    function invalidate() external {
        require(msg.sender == RESOLVER || msg.sender == CREATOR, Nimbus_Unauthorized());
        // Only invalidate an open/closed market.
        require(state == MarketState.OPEN || state == MarketState.CLOSED, Nimbus_MarketAlreadyResolved());
        
        state = MarketState.INVALID;
        
        emit MarketInvalidated(block.timestamp);
    }

    function claim() external returns (uint256 payout) {
        require(state == MarketState.RESOLVED, Nimbus_MarketNotResolved());
        require(!hasClaimed[msg.sender], Nimbus_AlreadyClaimed());
        
        UserPosition memory position = userPosition[msg.sender];
        uint256 winningShares = outcome ? position.yesBalance : position.noBalance;
        require(winningShares > 0, Nimbus_NoWinnings());
        
        uint256 totalWinningShares = outcome ? yesShares : noShares;
        payout = (winningShares * collateralPool) / totalWinningShares;
        
        hasClaimed[msg.sender] = true;
        
        TOKEN.safeTransfer(msg.sender, payout);
        
        emit WinningsClaimed(msg.sender, payout);
    }

    function claimRefund() external returns (uint256 refund) {
        require(state == MarketState.INVALID, "Market not invalid");
        require(!hasClaimed[msg.sender], Nimbus_AlreadyClaimed());
        
        UserPosition memory position = userPosition[msg.sender];
        uint256 userYes = position.yesBalance;
        uint256 userNo = position.noBalance;
        require(userYes > 0 || userNo > 0, Nimbus_NoWinnings());
        
        uint256 totalUserShares = userYes + userNo;
        uint256 totalShares = yesShares + noShares;
        refund = (totalUserShares * collateralPool) / totalShares;
        
        hasClaimed[msg.sender] = true;
        
        TOKEN.safeTransfer(msg.sender, refund);
        
        emit WinningsClaimed(msg.sender, refund);
    }

    function collectFees() external {
        require(msg.sender == FEE_RECIPIENT, Nimbus_Unauthorized());
        require(accumulatedFees > 0, "No fees");
        
        uint256 fees = accumulatedFees;
        accumulatedFees = 0;
        
        TOKEN.safeTransfer(FEE_RECIPIENT, fees);
        
        emit FeesCollected(FEE_RECIPIENT, fees);
    }

    function getBuyQuote(bool isYes, uint256 amount) public view returns (uint256 shares, Prices memory newPrices) {
        uint256 tradingAmount = amount - ((amount * PLATFORM_FEE_BPS) / 100);
        uint256 normalizedTradingAmount = _normalizeAmountTo18Decimals(tradingAmount);
        int256 price = isYes ? getPriceFromReserves().yesPrice : getPriceFromReserves().noPrice;
        shares = (normalizedTradingAmount * 1e18) / uint256(price);

        (int256 newXReserve, int256 newYReserve) = isYes ? _simulateXTrade(true, int256(shares)) : _simulateYTrade(true, int256(shares));

        newPrices = _getPriceFromReserves(newXReserve, newYReserve);
    }

    function getSellQuote(bool isYes, uint256 shares) public view returns (uint256 cost, Prices memory newPrices) {
        int256 price = isYes ? getPriceFromReserves().yesPrice : getPriceFromReserves().noPrice;

        (int256 newXReserve, int256 newYReserve) = isYes ? _simulateXTrade(false, int256(shares)) : _simulateYTrade(false, int256(shares));

        newPrices = _getPriceFromReserves(newXReserve, newYReserve);
        int256 newPrice = isYes ? newPrices.yesPrice : newPrices.noPrice;

        int256 cost18 = ((newPrice + price) * int256(shares)) / 2e18;
        cost = _normalizeAmountTo18Decimals(uint256(cost18));
    }

    function getUserPosition(address user) external view returns (UserPosition memory) {
        return userPosition[user];
    }

    function getMarketInfo() external view
        returns (
            string memory, string memory, address, address,
            uint96, uint64, MarketState, bool, Prices memory,
            int256,int256, uint256
        )
    {
        return (
            question,
            description,
            CREATOR,
            RESOLVER,
            END_TIME,
            RESOLUTION_TIME,
            state,
            outcome,
            getPriceFromReserves(),
            xReserve,
            yReserve,
            collateralPool
        );
    }

    function forceClose() external {
        require(block.timestamp >= END_TIME, Nimbus_TooEarly());
        require(state == MarketState.OPEN, "Not open");
        
        state = MarketState.CLOSED;
    }

    function _normalizeAmountTo18Decimals(uint256 amount) internal view returns (uint256 normalizedAmount) {
        normalizedAmount = (amount * 1e18) / (10 ** IERC20Metadata(address(TOKEN)).decimals());
    }

    function _normalizeAmountToDefaultDecimals(uint256 amount) internal view returns (uint256 normalizedAmount) {
        normalizedAmount = (amount * 10 ** IERC20Metadata(address(TOKEN)).decimals()) / 1e18;
    }
}