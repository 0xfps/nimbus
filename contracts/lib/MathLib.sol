// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title MathLib
 * @notice Mathematical operations for prediction markets
 */
library MathLib {
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    function bisectY(
        function(int256, int256, int256) pure returns (bool) evaluate,
        int256 yLowLimit,
        int256 yHighLimit,
        int256 newXReserve,
        int256 leff
    ) internal pure returns (int256 yLow) {
        int256 fineness = 1e5;
        yLow = yLowLimit;
        int256 yHigh = yHighLimit;

        while (yHigh - yLow > fineness) {
            int256 yAvg = (yHigh + yLow) / 2;
            if (evaluate(newXReserve, yAvg, leff)) yHigh = yAvg;
            else yLow = yAvg; 
        }
    }

    function bisectX(
        function(int256, int256, int256) pure returns (bool) evaluate,
        int256 xLowLimit,
        int256 xHighLimit,
        int256 newYReserve,
        int256 leff
    ) internal pure returns (int256 xLow) {
        int256 fineness = 1e5;
        xLow = xLowLimit;
        int256 xHigh = xHighLimit;

        while (xHigh - xLow > fineness) {
            int256 xAvg = (xHigh + xLow) / 2;
            if (evaluate(xAvg, newYReserve, leff)) xHigh = xAvg;
            else xLow = xAvg; 
        }
    }
}
