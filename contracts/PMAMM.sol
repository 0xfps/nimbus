// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Gaussian } from "@solstat/src/Gaussian.sol";

abstract contract PMAMM {
    function getEffectiveLiquidity() public view returns (int256 leff) {}
    function getPriceFromReserves() public view returns (uint16, uint16) {}

    function tradeX(bool isBuy, uint256 shares) public {}
    function evaluateX(uint256 x, uint256 newYReserve, int256 leff) public view returns (bool) {}

    function tradeY(bool isBuy, uint256 shares) public {}
    function evaluateY(uint256 newXReserve, uint256 y, int256 leff) public view returns (bool) {}
}