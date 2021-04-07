// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import {IERC20} from '@aave/aave-stake/contracts/interfaces/IERC20.sol';
import {
  ILendingPoolAddressesProviderRegistry
} from '../interfaces/ILendingPoolAddressesProviderRegistry.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPoolConfigurator} from '../interfaces/ILendingPoolConfigurator.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IAaveEcosystemReserve} from '../interfaces/IAaveEcosystemReserve.sol';
import {IProposalIncentivesExecutor} from '../interfaces/IProposalIncentivesExecutor.sol';

import 'hardhat/console.sol';

contract ProposalIncentivesExecutor is IProposalIncentivesExecutor {
  function execute(
    address[] memory reserves,
    address[] memory aTokenImplementations,
    address lendingPoolRegistryAddress,
    address incentivesControllerAddress,
    address ecosystemReserveAddress,
    address aaveToken,
    uint256 distributionDuration,
    uint256 distributionAmount
  ) external override {
    require(reserves.length > 0, 'Reserves can not be empty');
    require(
      reserves.length == aTokenImplementations.length,
      'Reserves and aTokens length missmatch'
    );
    require(
      lendingPoolRegistryAddress != address(0),
      'Lending Pool Addresses Registry must be set'
    );
    require(incentivesControllerAddress != address(0), 'Incentives controller must be set');

    address[] memory providerAddresses =
      ILendingPoolAddressesProviderRegistry(lendingPoolRegistryAddress).getAddressesProvidersList();
    require(providerAddresses[0] != address(0), 'Lending Pool Address Provider must be registered');

    ILendingPoolAddressesProvider lendingPoolAddressesProvider =
      ILendingPoolAddressesProvider(providerAddresses[0]);
    ILendingPoolConfigurator poolConfigurator =
      ILendingPoolConfigurator(lendingPoolAddressesProvider.getLendingPoolConfigurator());
    IAaveIncentivesController incentivesController =
      IAaveIncentivesController(incentivesControllerAddress);
    IAaveEcosystemReserve ecosystemReserve = IAaveEcosystemReserve(ecosystemReserveAddress);

    // Update each reserve aToken implementation
    for (uint256 x; x < reserves.length; x++) {
      poolConfigurator.updateAToken(reserves[x], aTokenImplementations[x]);
    }

    // Transfer funds to the Incentives Controller
    ecosystemReserve.transfer(IERC20(aaveToken), incentivesControllerAddress, distributionAmount);

    // Extend distribution at the incentives controller
    incentivesController.extendDistribution(distributionDuration);
  }
}
