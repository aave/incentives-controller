// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
import {IERC20} from '@aave/aave-stake/contracts/interfaces/IERC20.sol';

interface IAaveEcosystemReserve {
  function transfer(
    IERC20 token,
    address recipient,
    uint256 amount
  ) external;
}
