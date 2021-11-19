// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import {ITransferStrategy} from '../interfaces/ITransferStrategy.sol';

library DistributionTypesV2 {
  struct RewardsConfigInput {
    uint104 emissionPerSecond;
    uint256 totalStaked;
    uint40 distributionEnd;
    address asset;
    address reward;
    ITransferStrategy transferStrategy;
    bytes transferStrategyParams;
  }

  struct UserStakeInput {
    address underlyingAsset;
    uint256 stakedByUser;
    uint256 totalStaked;
  }
}
