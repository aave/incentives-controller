// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {IAaveIncentivesController} from './IAaveIncentivesController.sol';

interface IStakedTokenIncentivesController is IAaveIncentivesController {
  
   event ClaimerSet(address indexed user, address indexed claimer);
 
  /**
   * @dev Whitelists an address to claim the rewards on behalf of another address
   * @param user The address of the user
   * @param claimer The address of the claimer
   */
  function setClaimer(address user, address claimer) external;

  /**
   * @dev Returns the whitelisted claimer for a certain address (0x0 if not set)
   * @param user The address of the user
   * @return The claimer address
   */
  function getClaimer(address user) external view returns (address);
}
