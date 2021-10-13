// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;

import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {IProposalIncentivesRev2Executor} from '../interfaces/IProposalIncentivesRev2Executor.sol';

contract ProposalIncentivesRev2Executor is IProposalIncentivesRev2Executor {
  address constant INCENTIVES_CONTROLLER_IMPL_ADDRESS = 0xD9ED413bCF58c266F95fE6BA63B13cf79299CE31;
  address constant LENDING_POOL_ADDRESS_PROVIDER = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
  bytes32 constant LENDING_POOL_ID = bytes32(keccak256(bytes('INCENTIVES_CONTROLLER')));

  function execute() external override {
    ILendingPoolAddressesProvider(LENDING_POOL_ADDRESS_PROVIDER).setAddressAsProxy(
      LENDING_POOL_ID,
      INCENTIVES_CONTROLLER_IMPL_ADDRESS
    );
  }
}