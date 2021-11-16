// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {DataTypes} from '../utils/DataTypes.sol';
import {IAaveEcosystemReserveController} from '../interfaces/IAaveEcosystemReserveController.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IATokenDetailed} from '../interfaces/IATokenDetailed.sol';
import {ILendingPoolConfigurator} from '../interfaces/ILendingPoolConfigurator.sol';
import {ILendingPoolData} from '../interfaces/ILendingPoolData.sol';

contract IncentiveUpdateExecutor {

  address constant AAVE_TOKEN = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
  address constant ECO_RESERVE_ADDRESS = 0x1E506cbb6721B83B1549fa1558332381Ffa61A93;
  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address constant POOL_CONFIGURATOR = 0x311Bb771e4F8952E6Da169b425E7e92d6Ac45756;
  address constant INCENTIVES_CONTROLLER_PROXY_ADDRESS = 0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5;

  uint256 constant DISTRIBUTION_DURATION = 7776000;   // 90 days
  uint256 constant DISTRIBUTION_AMOUNT = 138600 ether;
  
  function execute(IATokenDetailed[] memory _aTokens, IATokenDetailed[] memory _debtTokens) external {

    IAaveEcosystemReserveController ecosystemReserveController = IAaveEcosystemReserveController(ECO_RESERVE_ADDRESS);
    IAaveIncentivesController incentivesController = IAaveIncentivesController(INCENTIVES_CONTROLLER_PROXY_ADDRESS);
    ILendingPoolConfigurator poolConfigurator = ILendingPoolConfigurator(POOL_CONFIGURATOR);

    address payable[19] memory reserves = [
      0x6B175474E89094C44Da98b954EedeAC495271d0F,   // DAI
      0x056Fd409E1d7A124BD7017459dFEa2F387b6d5Cd,   // GUSD
      0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48,   // USDC
      0xdAC17F958D2ee523a2206206994597C13D831ec7,   // USDT
      0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599,   // WBTC
      0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2,   // WETH
      0x514910771AF9Ca656af840dff83E8264EcF986CA,   // LINK
      0x57Ab1ec28D129707052df4dF418D58a2D46d5f51,   // sUSD
      0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e,   // YFI
      0x8798249c2E607446EfB7Ad49eC89dD1865Ff4272,   // xSUSHI
      0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984,   // UNI
      0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2,   // MKR
      0x0000000000085d4780B73119b644AE5ecd22b376,   // TUSD
      0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919,   // RAI
      0xba100000625a3754423978a60c9317c58a424e3D,   // BAL
      0x8E870D67F660D95d5be530380D0eC0bd388289E1,   // USDP
      0x853d955aCEf822Db058eb8505911ED77F175b99e,   // FRAX
      0x1494CA1F11D487c2bBe4543E90080AeBa4BA3C2b,   // DPI
      0x4Fabb145d64652a948d72533023f6E7A623C7C53    // BUSD
    ];

    uint256[] memory emissions = new uint256[](38);

    // TODO: update these to correct values
    emissions[0] = 5000000000000000;    // aDAI
    emissions[1] = 5000000000000000;    // vDebtDAI
    emissions[2] = 0;    // aGUSD
    emissions[3] = 0;    // vDebtGUSD
    emissions[4] = 5000000000000000;    // aUSDC
    emissions[5] = 5000000000000000;    // vDebtUSDC
    emissions[6] = 5000000000000000;    // aUSDT
    emissions[7] = 5000000000000000;    // vDebtUSDT
    emissions[8] = 5000000000000000;    // aWBTC
    emissions[9] = 0;    // vDebtWBTC
    emissions[10] = 5000000000000000;   // aWETH
    emissions[11] = 0;   // vDebtWETH
    emissions[12] = 5000000000000000;   // aLINK
    emissions[13] = 0;   // vDebtLINK
    emissions[14] = 5000000000000000;   // aSUSD
    emissions[15] = 5000000000000000;   // vDebtSUSD
    emissions[16] = 5000000000000000;   // aYFI
    emissions[17] = 0;   // vDebtYFI
    emissions[18] = 5000000000000000;   // aXSUSHI
    emissions[19] = 0;   // vDebtXSUSHI
    emissions[20] = 0;   // aUNI
    emissions[21] = 0;   // vDebtUNI
    emissions[22] = 5000000000000000;   // aMKR
    emissions[23] = 0;   // vDebtMKR
    emissions[24] = 5000000000000000;   // aTUSD
    emissions[25] = 5000000000000000;   // vDebtTUSD
    emissions[26] = 5000000000000000;   // aRAI
    emissions[27] = 5000000000000000;   // vDebtRAI
    emissions[28] = 5000000000000000;   // aBAL
    emissions[29] = 0;   // vDebtBAL
    emissions[30] = 5000000000000000;   // aUSDP
    emissions[31] = 5000000000000000;   // vDebtUSP
    emissions[32] = 5000000000000000;   // aFRAX
    emissions[33] = 5000000000000000;   // vDebtFRAX
    emissions[34] = 5000000000000000;   // aDPI
    emissions[35] = 0;   // vDebtDPI
    emissions[36] = 5000000000000000;    // aBUSD
    emissions[37] = 5000000000000000;    // vDebtBUSD

    // Update aTokens
    for (uint256 i = 0; i < _aTokens.length; i++) {
      address underlying = _aTokens[i].UNDERLYING_ASSET_ADDRESS();
      poolConfigurator.updateAToken(underlying, address(_aTokens[i]));
    }

    // Update vDebtTokens
    for (uint256 i = 0; i < _debtTokens.length; i++) {
      address underlying = _debtTokens[i].UNDERLYING_ASSET_ADDRESS();
      poolConfigurator.updateVariableDebtToken(underlying, address(_debtTokens[i]));
    }

    address[] memory assets = new address[](38);

    for (uint256 i = 0; i < reserves.length; i++) {
      DataTypes.ReserveData memory reserveData = ILendingPoolData(LENDING_POOL).getReserveData(reserves[i]);

      assets[2*i] = reserveData.aTokenAddress;
      assets[2*i+1] = reserveData.variableDebtTokenAddress;
    }

    // Transfer AAVE funds to the Incentives Controller
    ecosystemReserveController.transfer(
      AAVE_TOKEN,
      INCENTIVES_CONTROLLER_PROXY_ADDRESS,
      DISTRIBUTION_AMOUNT
    );

    // Enable incentives in aTokens and Variable Debt tokens
    incentivesController.configureAssets(assets, emissions);

    // Sets the end date for the distribution
    incentivesController.setDistributionEnd(block.timestamp + DISTRIBUTION_DURATION);
  }
}