// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { MarketCreationData, MarketType } from "../utils/Market.sol";

interface IPredictionMarketFactory {
    event MarketCreated(
        address indexed marketAddress,
        address indexed creator,
        address indexed resolver,
        string question,
        uint16 category,
        MarketType marketType,
        uint256 endTime
    );
    event ResolverApproved(address indexed resolver);
    event ResolverRevoked(address indexed resolver);

    error BackdatedMarket();
    error InvalidEndTime();
    error InvalidFee();
    error InvalidRecipient();
    error InvalidDuration();
    error ResolverNotApproved();
    error Unauthorized();

    function createBinaryMarket(MarketCreationData calldata marketCreationData) external returns (address market);
    function getTotalMarketCount() external view returns (uint256);

    function approveResolver(address resolver) external;
    function revokeResolver(address resolver) external;
    function setMinMarketDuration(uint24 duration) external;
    function setMaxMarketDuration(uint24 duration) external;
    function transferOwnership(address newOwner) external;
}
