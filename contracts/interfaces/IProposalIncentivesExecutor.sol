// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

interface IProposalIncentivesExecutor {
  function execute(
    address[] memory reserves,
    address[] memory aTokenImplementations,
    address lendingPoolRegistryAddress,
    address incentivesControllerAddress,
    address ecosystemReserveAddress,
    address aaveToken,
    uint256 distributionDuration,
    uint256 distributionAmount
  ) external;
}
