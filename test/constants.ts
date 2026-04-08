import { boolean } from "hardhat/internal/core/params/argumentTypes"

export const chris = "0x16b304365285D26D30e919e32Eef70B791957F92"
export const dave = "0x80aD9C622346Fb37C8E8046415fdA828e014E264"
export const edgar = "0x24f7b867d1C238CD826151D76a1311B00d5d48C1"
export const fisk = "0x153b42bFD285069c6bb6c98FCeB696a6d15B0563"

export enum MarketState {
    OPEN,       // Trading active.
    CLOSED,     // Trading ended, awaiting resolution.
    RESOLVED,   // Outcome determined.
    INVALID
}

export enum MarketType {
    BINARY,         // YES/NO.
    CATEGORICAL,    // Multiple outcomes.
    SCALAR,         // Range-based.
    CONDITIONAL
}

export function getRandomBoolean(): boolean {
    return parseInt((Math.random() * 1_000).toString()) % 2 == 0
}

export function reduceTo6Decimals(x: bigint): bigint {
    return (x * BigInt(1e6)) / BigInt(1e18)
}

export function takeFeesAndReturnBalance(amount: bigint): bigint {
    return amount - getFees(amount)
}

export function addFeesAndReturnBalance(amount: bigint): bigint {
    return (amount * 100n) / 90n
}

export function getFees(amount: bigint): bigint {
    return ((amount * 10n) / 100n)
}