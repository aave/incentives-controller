// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {DistributionTypes} from '@aave/aave-stake/contracts/lib/DistributionTypes.sol';

interface IAaveDistributionManager {
  
  event AssetConfigUpdated(address indexed asset, uint256 emission);
  event AssetIndexUpdated(address indexed asset, uint256 index);
  event UserIndexUpdated(address indexed user, address indexed asset);
  event DistributionEndUpdated(uint256 newDistributionEnd);

  /**
  * @dev Configure the assets for a specific emission
  * @param assetsConfigInput The array of each asset configuration
  **/
  function configureAssets(DistributionTypes.AssetConfigInput[] calldata assetsConfigInput)
    external;

  /**
  * @dev Sets the end date for the distribution
  * @param distributionEnd The end date timestamp
  **/
  function setDistributionEnd(uint256 distributionEnd) external;

  /**
  * @dev Gets the end date for the distribution
  * @return The end of the distribution
  **/
  function getDistributionEnd() external view returns (uint256);
}
