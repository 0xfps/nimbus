// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Prices } from "../utils/Market.sol";

interface IPredictionMarket {
    event FeesCollected(address indexed recipient, uint256 amount);
    event MarketInvalidated(uint256 timestamp);
    event MarketResolved(bool indexed outcome, uint256 timestamp);
    event Trade(
        address indexed trader,
        bool indexed isYes,
        bool indexed isBuy,
        uint256 shares,
        uint256 cost,
        Prices newPrices
    );
    event WinningsClaimed(address indexed user, uint256 amount);

    error Nimbus_AlreadyClaimed();
    error Nimbus_InsufficientLiquidity();
    error Nimbus_InvalidAmount();
    error Nimbus_MarketAlreadyResolved();
    error Nimbus_MarketClosed();
    error Nimbus_MarketNotClosed();
    error Nimbus_MarketNotResolved();
    error Nimbus_NoWinnings();
    error Nimbus_SlippageExceeded();
    error Nimbus_TooEarly();
    error Nimbus_TransferFailed();
    error Nimbus_Unauthorized();

    struct UserPosition {
        uint256 yesBalance;
        uint256 noBalance;
    }

    //  Slippage protection built in,
    //  users should buy by spending `amount` or lesser.
    function buy(
        bool isYes,
        uint256 amount,
        uint256 shares
    ) external;

    function sell(
        bool isYes,
        uint256 shares,
        uint256 minReturn, 
        address receiver
    ) external;
    
    function resolve(bool outcome) external;
    function invalidate() external;
    function claim() external returns (uint256 payout);
    function claimRefund() external returns (uint256 refund);

    function getBuyQuote(bool isYes, uint256 amount) external view returns (uint256 shares, Prices memory newPrices);
    function getSellQuote(bool isYes, uint256 shares) external view returns (uint256 cost, Prices memory newPrices);
    
    function getUserPosition(address user) external view returns (UserPosition memory);
}
