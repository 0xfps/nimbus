import { USDC } from "../../typechain-types";

export async function mint(usdc: USDC, address: string, amount: bigint) {
    await usdc.mint(address, amount)
}