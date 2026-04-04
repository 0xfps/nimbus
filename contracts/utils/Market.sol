// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum MarketState {
    OPEN,       // Trading active.
    CLOSED,     // Trading ended, awaiting resolution.
    RESOLVED,   // Outcome determined.
    INVALID     // Market invalidated.
}

enum MarketType {
    BINARY,         // YES/NO.
    CATEGORICAL,    // Multiple outcomes.
    SCALAR,         // Range-based.
    CONDITIONAL     // Depends on another market.
}

struct MarketInfo {
    MarketState marketState;
    MarketCreationData marketCreationData;
    uint64 createdAt;
    uint64 resolvedAt;
}

struct MarketCreationData {
    MarketType marketType;
    address creator;
    address resolver;
    address feeRecipient;
    uint16 platformFeeBps;
    string question;
    string description;
    uint16 category;
    uint16 subcategory;
    uint64 endTime;
}

struct Prices {
    int256 yesPrice;
    int256 noPrice;
}