// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { MarketCreationData } from "../utils/Market.sol";

interface IPredictionMarketFactory {
    event MarketCreated(address indexed marketAddress, address indexed creator);
    event ResolverApproved(address indexed resolver);
    event ResolverRevoked(address indexed resolver);

    error Nimbus_InvalidEndTime();
    error Nimbus_InvalidOwner();
    error Nimbus_InvalidRecipient();
    error Nimbus_ResolverNotApproved();
    error Nimbus_Unauthorized();

    function createBinaryMarket(MarketCreationData calldata marketCreationData) external returns (address market);

    function approveResolver(address resolver) external;
    function revokeResolver(address resolver) external;
    function transferOwnership(address newOwner) external;
}
