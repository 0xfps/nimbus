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
    address public token; 
    uint16 public constant MAX_FEE_BPS = 500;

    uint16 public platformFeeBps;
    uint24 public minMarketDuration = 1 hours;
    uint32 public maxMarketDuration = 365 days;
    address public feeRecipient;
    address public owner;

    uint256 public allMarketsLength;

    mapping(address => bool) public approvedResolvers;

    receive() external payable {}

    modifier onlyOwner() {
        if (msg.sender != owner) revert Nimbus_Unauthorized();
        _;
    }

    constructor(
        address _feeRecipient,
        uint16 _platformFeeBps,
        address _token
    ) {

        if (_feeRecipient == address(0)) revert Nimbus_InvalidRecipient();
        if (_platformFeeBps > MAX_FEE_BPS) revert Nimbus_InvalidFee();
        
        token = _token;
        owner = msg.sender;
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
        approvedResolvers[msg.sender] = true;
    }

    function createBinaryMarket(MarketCreationData calldata marketCreationData) external returns (address market) {
        _validateMarketParams(marketCreationData);
        market = address(new PredictionMarket(token, marketCreationData));

        allMarketsLength++;

        emit MarketCreated(market, msg.sender);
    }

    function approveResolver(address resolver) external onlyOwner {
        if (!approvedResolvers[resolver]) {
            approvedResolvers[resolver] = true;
            emit ResolverApproved(resolver);
        }
    }

    function revokeResolver(address resolver) external onlyOwner {
        if (approvedResolvers[resolver]) {
            delete approvedResolvers[resolver];
            emit ResolverRevoked(resolver);
        }
    }

    function setNewToken(address _token) external onlyOwner {
       token = _token;
    }

    function setMinMarketDuration(uint24 duration) external onlyOwner {
        minMarketDuration = duration;
    }

    function setMaxMarketDuration(uint24 duration) external onlyOwner {
        maxMarketDuration = duration;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert Nimbus_InvalidOwner();
        owner = newOwner;
    }

    function getTotalMarketCount() external view returns (uint256) {
        return allMarketsLength;
    }

    function _validateMarketParams(MarketCreationData calldata marketCreationData) internal view {
        address resolver = marketCreationData.resolver;
        uint256 duration = marketCreationData.endTime - block.timestamp;
        uint64 marketEndTime = marketCreationData.endTime;

        if (marketEndTime <= block.timestamp) revert Nimbus_InvalidEndTime();
        if (marketCreationData.feeRecipient == address(0)) revert Nimbus_InvalidRecipient();
        if (!approvedResolvers[resolver]) revert Nimbus_ResolverNotApproved();
        if (duration < minMarketDuration || duration > maxMarketDuration) revert Nimbus_InvalidDuration();
    }
}