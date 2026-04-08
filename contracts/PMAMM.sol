// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Gaussian } from "@solstat/src/Gaussian.sol";
import { MathLib } from "./lib/MathLib.sol";

import { Prices } from "./utils/Market.sol";

abstract contract PMAMM {
    int64 public constant MAX_PRICE = 1e18;
    int64 public constant STARTING_PRICE = 5 * 1e17;

    uint16 public immutable LIQUIDITY_FACTOR;
    uint96 public immutable END_TIME;

    // Price untracked via variable.
    // Price tracking happens with the getPriceFromReserves.
    int256 public xReserve;
    int256 public yReserve;

    error PMAMM_XLiquidityInsufficient();
    error PMAMM_YLiquidityInsufficient();
    error PMAMM_XLiquidityDepleted();
    error PMAMM_YLiquidityDepleted();

    constructor(uint16 liquidityFactor, uint96 endTime) {
        LIQUIDITY_FACTOR = liquidityFactor == 0 ? 10000 : liquidityFactor;
        END_TIME = endTime;
        (xReserve, yReserve) = _getReservesFromStartingPrice();
    }

    function getEffectiveLiquidity() public view returns (int256 leff) {
        if (END_TIME < block.timestamp) return int256(uint256(LIQUIDITY_FACTOR));
        return int256(LIQUIDITY_FACTOR * MathLib.sqrt(END_TIME - block.timestamp));
    }

    function getPriceFromReserves() public view returns (Prices memory prices) {
        return _getPriceFromReserves(xReserve, yReserve);
    }

    function tradeX(bool isBuy, int256 shares) internal returns (int256 newYReserve) {
        if (isBuy && shares > xReserve) revert PMAMM_XLiquidityInsufficient();

        (int256 newX, int256 newY) = _simulateXTrade(isBuy, shares);
        int256 newXReserve = newX;
        newYReserve = newY;

        if (!isBuy && newYReserve <= 0) revert PMAMM_YLiquidityDepleted();

        xReserve = newXReserve;
        yReserve = newYReserve;
    }

    function tradeY(bool isBuy, int256 shares) internal returns (int256 newXReserve) {
        if (isBuy && shares > yReserve) revert PMAMM_YLiquidityInsufficient();

        (int256 newX, int256 newY) = _simulateYTrade(isBuy, shares);
        newXReserve = newX;
        int256 newYReserve = newY;

        if (!isBuy && newXReserve <= 0) revert PMAMM_XLiquidityDepleted();

        xReserve = newXReserve;
        yReserve = newYReserve;
    }

    function invariant(int256 x, int256 y, int256 leff) internal pure returns (int256) {
        int256 z = (y - x) / leff;
        // Divide first part by 1e18 to maintain precision as y-x * gaussian z gives 1e36.
        return (((y - x) * Gaussian.cdf(z)) / 1e18) + (leff * Gaussian.pdf(z)) - y;
    }

    function evaluate(int256 x, int256 y, int256 leff) internal pure returns (bool) {
        return invariant(x, y, leff) < 0;
    }

    function _simulateXTrade(bool isBuy, int256 shares) internal view returns (int256 newXReserve, int256 newYReserve) {
        int256 leff = getEffectiveLiquidity();
        newXReserve = isBuy ? xReserve - shares : xReserve + shares;

        int256 currentYReserve = yReserve;
        (int256 min, int256 max) = _getMinAndMaxYReservesForNewXReserve(
            currentYReserve,
            newXReserve,
            leff
        );

        newYReserve = MathLib.bisectY(
            evaluate,
            min, // Get average Y from min and max for evaluate.
            max,
            newXReserve,
            leff
        );
    }

    function _simulateYTrade(bool isBuy, int256 shares) internal view returns (int256 newXReserve, int256 newYReserve) {
        int256 leff = getEffectiveLiquidity();
        newYReserve = isBuy ? yReserve - shares : yReserve + shares;

        int256 currentXReserve = xReserve;
        (int256 min, int256 max) = _getMinAndMaxXReservesForNewYReserve(
            currentXReserve,
            newYReserve,
            leff
        );

        newXReserve = MathLib.bisectX(
            evaluate,
            min, // Get average X from min and max for evaluate.
            max,
            newYReserve,
            leff
        );
    }

    function _getPriceFromReserves(int256 x, int256 y) internal view returns (Prices memory prices) {
        int256 leff = getEffectiveLiquidity();
        int256 z = (y - x) / leff;
        int256 xPrice = Gaussian.cdf(z);
        int256 yPrice = MAX_PRICE - xPrice;

        return Prices(xPrice, yPrice);
    }

    function _getReservesFromStartingPrice() private view returns (int256 x, int256 y) {
        int256 leff = getEffectiveLiquidity();
        int256 z = Gaussian.ppf(STARTING_PRICE);
        int256 diff = z * leff; // Returns diff in 1e18.
        // Keeps y in 1e18 by eliminating the 1e18 in STARTING_PRICE.
        // Gaussian returns in 1e18, so it's 1e18 + 1e18.
        y = ((diff * STARTING_PRICE) / 1e18) + (leff * Gaussian.pdf(z));
        x = y - diff;
    }

    function _getMinAndMaxYReservesForNewXReserve(int256 _currentYReserve, int256 _newXReserve, int256 leff) private pure returns (int256, int256) {
        int256 minYReserve; int256 maxYReserve;
        bool minYEvaluation; bool maxYEvaluation;
        int256 margin = 5000e18;
        int256 currentYReserve = _currentYReserve;

        while(!maxYEvaluation) {
            maxYEvaluation = invariant(_newXReserve, currentYReserve, leff) < 0;
            currentYReserve += margin;
        }

        maxYReserve = currentYReserve;

        while(!minYEvaluation) {
            currentYReserve -= margin;
            minYEvaluation = invariant(_newXReserve, currentYReserve, leff) > 0;
        }

        minYReserve = currentYReserve;

        return (minYReserve, maxYReserve);
    }

    function _getMinAndMaxXReservesForNewYReserve(int256 _currentXReserve, int256 _newYReserve, int256 leff) private pure returns (int256, int256) {
        int256 minXReserve; int256 maxXReserve;
        bool minXEvaluation; bool maxXEvaluation;
        int256 margin = 5000e18;
        int256 currentXReserve = _currentXReserve;

        while(!maxXEvaluation) {
            maxXEvaluation = invariant(currentXReserve, _newYReserve, leff) < 0;
            currentXReserve += margin;
        }

        maxXReserve = currentXReserve;

        while(!minXEvaluation) {
            currentXReserve -= margin;
            minXEvaluation = invariant(currentXReserve, _newYReserve, leff) > 0;
        }

        minXReserve = currentXReserve;

        return (minXReserve, maxXReserve);
    }
}