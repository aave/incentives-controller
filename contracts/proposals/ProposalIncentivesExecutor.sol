// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {IERC20} from '@aave/aave-stake/contracts/interfaces/IERC20.sol';
import {ILendingPoolAddressesProvider} from '../interfaces/ILendingPoolAddressesProvider.sol';
import {ILendingPoolConfigurator} from '../interfaces/ILendingPoolConfigurator.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IAaveEcosystemReserve} from '../interfaces/IAaveEcosystemReserve.sol';
import {IProposalIncentivesExecutor} from '../interfaces/IProposalIncentivesExecutor.sol';
import {DistributionTypes} from '@aave/aave-stake/contracts/lib/DistributionTypes.sol';
import {DataTypes} from '../utils/DataTypes.sol';
import {ILendingPoolData} from '../interfaces/ILendingPoolData.sol';
import 'hardhat/console.sol';

contract ProposalIncentivesExecutor is IProposalIncentivesExecutor {
  // Reserves Order: USDT/USDC/DAI/WETH/WBTC/GUSD
  address constant USDT = 0xdAC17F958D2ee523a2206206994597C13D831ec7;
  address constant USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
  address constant DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
  address constant WETH = 0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2;
  address constant WBTC = 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599;
  address constant GUSD = 0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd;

  address constant AAVE_TOKEN = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
  address constant POOL_CONFIGURATOR = 0x311Bb771e4F8952E6Da169b425E7e92d6Ac45756;
  address constant POOL_PROVIDER = 0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5;
  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address constant ECO_RESERVE_ADDRESS = 0x25F2226B597E8F9514B3F68F00f494cF4f286491;

  // TODO: Random constants below, pending revision
  uint256 constant DISTRIBUTION_DURATION = 31536000; // 1 YEAR
  uint256 constant DISTRIBUTION_AMOUNT = 99600000000000000000000; // 99600 AAVE
  uint128 constant EMISSION_PER_SECOND = 3044140000000000; // 0.00304414 AAVE per second

  function execute(
    address incentivesControllerAddress,
    address[6] memory aTokenImplementations,
    address[6] memory variableDebtImplementation
  ) external override {
    uint256 tokensCounter = 0;
    address[6] memory reserves = [USDT, USDC, DAI, WETH, WBTC, GUSD];
    DistributionTypes.AssetConfigInput[] memory incentivicedTokens;
    ILendingPoolConfigurator poolConfigurator = ILendingPoolConfigurator(POOL_CONFIGURATOR);
    IAaveIncentivesController incentivesController =
      IAaveIncentivesController(incentivesControllerAddress);
    IAaveEcosystemReserve ecosystemReserve = IAaveEcosystemReserve(ECO_RESERVE_ADDRESS);

    require(
      aTokenImplementations.length == variableDebtImplementation.length &&
        aTokenImplementations.length == reserves.length,
      'Array length missmatch'
    );

    // Update each reserve AToken implementation, Debt implementation, and prepare incentives configuration input
    for (uint256 x; x < reserves.length; x++) {
      DataTypes.ReserveData memory reserveData =
        ILendingPoolData(LENDING_POOL).getReserveData(reserves[x]);
      // Update aToken impl
      poolConfigurator.updateAToken(reserves[x], aTokenImplementations[x]);

      // Update variable debt impl
      poolConfigurator.updateVariableDebtToken(reserves[x], variableDebtImplementation[x]);

      // Configure aToken at incentives controller
      incentivicedTokens[tokensCounter] = DistributionTypes.AssetConfigInput({
        emissionPerSecond: EMISSION_PER_SECOND,
        totalStaked: IERC20(reserveData.aTokenAddress).totalSupply(),
        underlyingAsset: reserveData.aTokenAddress
      });
      tokensCounter++;

      // Configure variable debt token at incentives controller
      incentivicedTokens[tokensCounter] = DistributionTypes.AssetConfigInput({
        emissionPerSecond: EMISSION_PER_SECOND,
        totalStaked: IERC20(reserveData.variableDebtTokenAddress).totalSupply(),
        underlyingAsset: reserveData.variableDebtTokenAddress
      });
      tokensCounter++;
    }
    // Transfer AAVE funds to the Incentives Controller
    ecosystemReserve.transfer(IERC20(AAVE_TOKEN), incentivesControllerAddress, DISTRIBUTION_AMOUNT);

    // Enable incentives in aTokens and Variable Debt tokens
    incentivesController.configureAssets(incentivicedTokens);

    // Extend distribution at the incentives controller
    //incentivesController.extendDistribution(DISTRIBUTION_DURATION);
  }
}
