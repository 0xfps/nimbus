// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { IPredictionMarket } from "./interfaces/IPredictionMarket.sol";

import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import { MarketCreationData, MarketState } from "./utils/Market.sol";
import { PMAMM } from "./PMAMM.sol";
import { Prices } from "./utils/Market.sol";

/**
 * @title PredictionMarket
 * @notice Individual binary prediction market with AMM-based trading
 * @dev Uses constant product AMM for price discovery and liquidity
 */
contract PredictionMarket is IPredictionMarket, PMAMM {
    using SafeERC20 for IERC20;
    
    bool internal guard;
    uint16 public constant PRESET_LIQUIDITY_FACTOR = 10000;
    uint16 public constant PLATFORM_FEE_BPS = 10;

    IERC20 public immutable TOKEN;
    address public immutable CREATOR;
    address public immutable RESOLVER;
    address public immutable FEE_RECIPIENT;

    uint96 public resolutionTime;

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

    modifier nonReentrant() {
        if (guard) revert Nimbus_Reentrancy();
        guard = true;
        _;
        delete guard;
    }

    constructor(address token, MarketCreationData memory marketCreationData)
    PMAMM (PRESET_LIQUIDITY_FACTOR, marketCreationData.endTime) {
        TOKEN = IERC20(token);

        question = marketCreationData.question;
        description = marketCreationData.description;
        CREATOR = marketCreationData.creator;
        RESOLVER = marketCreationData.resolver;
        FEE_RECIPIENT = marketCreationData.feeRecipient;
    }

    // Amount is coming in USDC.
    function buy(bool isYes, uint256 amount, uint256 shares) public nonReentrant {
        if (state != MarketState.OPEN) revert Nimbus_MarketClosed();
        if (block.timestamp >= END_TIME) revert Nimbus_MarketClosed();
        if (xReserve <= 0 || yReserve <= 0) revert Nimbus_InsufficientLiquidity();

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

        if (costInUsdc > amount) revert Nimbus_InflatedCost();
        
        uint256 balance = amount - costInUsdc;

        uint256 platformFee = (costInUsdc * PLATFORM_FEE_BPS) / 100;
        accumulatedFees += platformFee;

        uint256 tradingAmount = costInUsdc - platformFee;
        collateralPool += tradingAmount;

        TOKEN.safeTransfer(msg.sender, balance);

        emit Buy(msg.sender, isYes, shares, costInUsdc);
    }

    function sell(bool isYes, uint256 shares, uint256 minReturn) public {
        if (state != MarketState.OPEN) revert Nimbus_MarketClosed();
        if (block.timestamp >= END_TIME) revert Nimbus_MarketClosed();
        if (shares == 0) revert Nimbus_InvalidAmount();
        
        uint256 userBalance = isYes ? userPosition[msg.sender].yesBalance : userPosition[msg.sender].noBalance;
        if (userBalance < shares) revert Nimbus_InsufficientAmount();

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

        // Possible bug here in cost of sale computation.
        int256 cost = ((currentPrice + newPrice) * int256(shares)) / 2e18;
        uint256 costInUsdc = _normalizeAmountToDefaultDecimals(uint256(cost));

        if (costInUsdc < minReturn) revert Nimbus_DeflatedCost();

        collateralPool -= costInUsdc;

        TOKEN.safeTransfer(msg.sender, costInUsdc);

        emit Sell(msg.sender, isYes, shares, costInUsdc);
    }

    function claim() public returns (uint256 payout) {
        if (state != MarketState.RESOLVED) revert Nimbus_MarketNotResolved();
        if (hasClaimed[msg.sender]) revert Nimbus_AlreadyClaimed();
        
        UserPosition memory position = userPosition[msg.sender];
        uint256 winningShares = outcome ? position.yesBalance : position.noBalance;
        if (winningShares == 0) revert Nimbus_NoWinnings();
        
        uint256 totalWinningShares = outcome ? yesShares : noShares;
        payout = (winningShares * collateralPool) / totalWinningShares;
        
        hasClaimed[msg.sender] = true;
        
        TOKEN.safeTransfer(msg.sender, payout);
        
        emit WinningsClaimed(msg.sender, payout);
    }

    function claimRefund() public returns (uint256 refund) {
        if (state != MarketState.INVALID) revert Nimbus_MarketNotInvalid();
        if (hasClaimed[msg.sender]) revert Nimbus_AlreadyClaimed();
        
        UserPosition memory position = userPosition[msg.sender];
        uint256 userYes = position.yesBalance;
        uint256 userNo = position.noBalance;
        if (userYes == 0 && userNo == 0) revert Nimbus_NoWinnings();
        
        uint256 totalUserShares = userYes + userNo;
        uint256 totalShares = yesShares + noShares;
        refund = (totalUserShares * collateralPool) / totalShares;
        
        hasClaimed[msg.sender] = true;
        
        TOKEN.safeTransfer(msg.sender, refund);
        
        emit WinningsClaimed(msg.sender, refund);
    }

    function collectFees() public {
        if (msg.sender != FEE_RECIPIENT) revert Nimbus_Unauthorized();
        if (accumulatedFees == 0) revert Nimbus_NoFees();
        
        uint256 fees = accumulatedFees;
        accumulatedFees = 0;
        
        TOKEN.safeTransfer(FEE_RECIPIENT, fees);
        
        emit FeesCollected(FEE_RECIPIENT, fees);
    }

    function resolve(bool _outcome) public {
        if (msg.sender != RESOLVER) revert Nimbus_Unauthorized();
        if (block.timestamp < END_TIME) revert Nimbus_TooEarly();
        if (state == MarketState.RESOLVED) revert Nimbus_MarketAlreadyResolved();
        if (state == MarketState.INVALID) revert Nimbus_MarketInvalid();
        
        outcome = _outcome;
        state = MarketState.RESOLVED;
        resolutionTime = uint96(block.timestamp);
        
        emit MarketResolved(_outcome, block.timestamp);
    }

    function invalidate() public {
        if (msg.sender != RESOLVER && msg.sender != CREATOR) revert Nimbus_Unauthorized();
        if (state == MarketState.CLOSED) revert Nimbus_MarketClosed();
        if (state == MarketState.RESOLVED) revert Nimbus_MarketAlreadyResolved();
        
        state = MarketState.INVALID;
        
        emit MarketInvalidated(block.timestamp);
    }

    function forceClose() public {
        if (block.timestamp < END_TIME) revert Nimbus_TooEarly();
        if (state != MarketState.OPEN) revert Nimbus_NotOpen();
        
        state = MarketState.CLOSED;
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
        cost = _normalizeAmountToDefaultDecimals(uint256(cost18));
    }

    function getUserPosition(address user) public view returns (UserPosition memory) {
        return userPosition[user];
    }

    function getMarketInfo() public view
        returns (
            string memory, string memory, address, address,
            uint96, uint96, MarketState, bool, Prices memory,
            int256,int256, uint256
        )
    {
        return (
            question,
            description,
            CREATOR,
            RESOLVER,
            END_TIME,
            resolutionTime,
            state,
            outcome,
            getPriceFromReserves(),
            xReserve,
            yReserve,
            collateralPool
        );
    }

    function _normalizeAmountTo18Decimals(uint256 amount) internal view returns (uint256 normalizedAmount) {
        normalizedAmount = (amount * 1e18) / (10 ** IERC20Metadata(address(TOKEN)).decimals());
    }

    function _normalizeAmountToDefaultDecimals(uint256 amount) internal view returns (uint256 normalizedAmount) {
        normalizedAmount = (amount * 10 ** IERC20Metadata(address(TOKEN)).decimals()) / 1e18;
    }
}