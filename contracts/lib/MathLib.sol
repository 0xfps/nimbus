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
        int256 lowLimit,
        int256 highLimit,
        int256 newXReserve,
        int256 leff
    ) internal pure returns (int256 low) {
        int256 fineness = 1e5;
        low = lowLimit;
        int256 high = highLimit;

        while (high - low > fineness) {
            int256 avg = (high + low) / 2;
            if (evaluate(avg, newXReserve, leff)) high = avg;
            else low = avg; 
        }
    }

    function bisectX(
        function(int256, int256, int256) pure returns (bool) evaluate,
        int256 lowLimit,
        int256 highLimit,
        int256 newXReserve,
        int256 leff
    ) internal pure returns (int256 low) {
        int256 fineness = 1e5;
        low = lowLimit;
        int256 high = highLimit;

        while (high - low > fineness) {
            int256 avg = (high + low) / 2;
            if (evaluate(newXReserve, avg, leff)) high = avg;
            else low = avg; 
        }
    }
}
