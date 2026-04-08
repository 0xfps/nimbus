// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IPredictionMarketFactory } from "./interfaces/IPredictionMarketFactory.sol";

import { MarketCreationData } from "./utils/Market.sol";
import { PredictionMarket } from "./PredictionMarket.sol";

/**
 * @title PredictionMarketFactory
 * @notice Factory contract for creating and managing prediction markets.
 * @dev Supports multiple market types, categories, and resolution mechanisms.
 */
contract PredictionMarketFactory is IPredictionMarketFactory {
    address public immutable TOKEN; 
    address public owner;
    uint256 public allMarketsLength;

    mapping(address => bool) public approvedResolvers;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Nimbus_Unauthorized();
        _;
    }

    constructor(address token, address _owner) {
        TOKEN = token;
        owner = _owner;
        approveResolver(msg.sender);
    }

    function createBinaryMarket(MarketCreationData calldata marketCreationData) public returns (address market) {
        _validateMarketParams(marketCreationData);
        market = address(new PredictionMarket(TOKEN, marketCreationData));

        allMarketsLength++;

        emit MarketCreated(market, msg.sender);
    }

    function approveResolver(address resolver) public onlyOwner {
        if (!approvedResolvers[resolver]) {
            approvedResolvers[resolver] = true;
            emit ResolverApproved(resolver);
        }
    }

    function revokeResolver(address resolver) public onlyOwner {
        if (approvedResolvers[resolver]) {
            delete approvedResolvers[resolver];
            emit ResolverRevoked(resolver);
        }
    }

    function transferOwnership(address newOwner) public onlyOwner {
        if (newOwner == address(0)) revert Nimbus_InvalidOwner();
        owner = newOwner;
    }

    function _validateMarketParams(MarketCreationData calldata marketCreationData) internal view {
        address resolver = marketCreationData.resolver;
        uint64 marketEndTime = marketCreationData.endTime;

        if (marketEndTime <= block.timestamp) revert Nimbus_InvalidEndTime();
        if (marketCreationData.feeRecipient == address(0)) revert Nimbus_InvalidRecipient();
        if (!approvedResolvers[resolver]) revert Nimbus_ResolverNotApproved();
    }
}