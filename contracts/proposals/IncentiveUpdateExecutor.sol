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
  address constant CONTROLLER_ECO_RESERVE = 0x1E506cbb6721B83B1549fa1558332381Ffa61A93;
  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address constant POOL_CONFIGURATOR = 0x311Bb771e4F8952E6Da169b425E7e92d6Ac45756;
  address constant INCENTIVES_CONTROLLER_PROXY_ADDRESS = 0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5;

  uint256 constant DISTRIBUTION_DURATION = 7776000;   // 90 days
  uint256 constant DISTRIBUTION_AMOUNT = 138600 ether;

  uint256 constant PROPOSER_GAS_REFUND = 70 ether;
  address constant PROPOSER_REFUND_ADDRESS = 0x6904110f17feD2162a11B5FA66B188d801443Ea4;
  
  function execute() external {

    IAaveEcosystemReserveController ecosystemReserveController = IAaveEcosystemReserveController(CONTROLLER_ECO_RESERVE);
    IAaveIncentivesController incentivesController = IAaveIncentivesController(INCENTIVES_CONTROLLER_PROXY_ADDRESS);
    ILendingPoolConfigurator poolConfigurator = ILendingPoolConfigurator(POOL_CONFIGURATOR);

    address payable[4] memory aTokens = [
      0x00c92Eb9eba1e4F90233B5e4c846A97dDACE0F5B,   // aDPI
      0xc84E16357b4204523a80E9e4c0cFc8f8EC1613d3,   // aBUSD
      0xB5AE2299c71aFFDc2dAd3B53974D56d5651FDD35,   // aFRAX
      0xd78037ED778ec3E2FCDb03B622c42d2F1B66D469    // aCRV
    ];

    address payable[4] memory vDebtTokens = [
      address(0),                                   // vDebtDPI
      0xCFC5923024E782Cb2862520CCfFD48Ad24e7825a,   // vDebtBUSD
      0xc67c18F4620e003c78fd041Fb5172Cb20642FD47,   // vDebtFRAX
      address(0)                                    // vDebtCRV
    ];

    address payable[20] memory reserves = [
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
      0x4Fabb145d64652a948d72533023f6E7A623C7C53,   // BUSD
      0xD533a949740bb3306d119CC777fa900bA034cd52    // CRV
    ];

    uint256[] memory emissions = new uint256[](40);

    emissions[0] = 1203204146880510;    // aDAI
    emissions[1] = 2406408293761020;    // vDebtDAI
    emissions[2] = 0;                   // aGUSD
    emissions[3] = 0;                   // vDebtGUSD
    emissions[4] = 2674448821531440;    // aUSDC
    emissions[5] = 5348897643062870;    // vDebtUSDC
    emissions[6] = 780295758620530;     // aUSDT
    emissions[7] = 1560591517241060;    // vDebtUSDT
    emissions[8] = 538517489758869;     // aWBTC
    emissions[9] = 0;                   // vDebtWBTC
    emissions[10] = 2061139949740800;   // aWETH
    emissions[11] = 0;                  // vDebtWETH
    emissions[12] = 473219265599667;    // aLINK
    emissions[13] = 0;                  // vDebtLINK
    emissions[14] = 35280089910759;     // aSUSD
    emissions[15] = 70560179821518;     // vDebtSUSD
    emissions[16] = 47620672711642;     // aYFI
    emissions[17] = 0;                  // vDebtYFI
    emissions[18] = 101144783834246;    // aXSUSHI
    emissions[19] = 0;                  // vDebtXSUSHI
    emissions[20] = 0;                  // aUNI
    emissions[21] = 0;                  // vDebtUNI
    emissions[22] = 128538286894602;    // aMKR
    emissions[23] = 0;                  // vDebtMKR
    emissions[24] = 49670888023944;     // aTUSD
    emissions[25] = 99341776047887;     // vDebtTUSD
    emissions[26] = 25422154944980;     // aRAI
    emissions[27] = 50844309889961;     // vDebtRAI
    emissions[28] = 13725047526598;     // aBAL
    emissions[29] = 0;                  // vDebtBAL
    emissions[30] = 9935368896023;      // aUSDP
    emissions[31] = 19870737792047;     // vDebtUSP
    emissions[32] = 5807544768359;      // aFRAX
    emissions[33] = 11615089536718;     // vDebtFRAX
    emissions[34] = 53890469813093;     // aDPI
    emissions[35] = 0;                  // vDebtDPI
    emissions[36] = 5176160414055;      // aBUSD
    emissions[37] = 10352320828111;     // vDebtBUSD
    emissions[38] = 37118390250968;     // aCRV
    emissions[39] = 0;                  // vDebtCRV

    // Update aTokens and vDebtTokens
    for (uint256 i = 0; i < aTokens.length; i++) {

      address underlying = IATokenDetailed(aTokens[i]).UNDERLYING_ASSET_ADDRESS();
      poolConfigurator.updateAToken(underlying, address(aTokens[i]));

      if (vDebtTokens[i] != address(0)) {
        poolConfigurator.updateVariableDebtToken(underlying, address(vDebtTokens[i]));
      }
    }

    address[] memory assets = new address[](40);

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

    // Transfer AAVE funds to the proposer to reimburse gas costs
    ecosystemReserveController.transfer(
      AAVE_TOKEN,
      PROPOSER_REFUND_ADDRESS,
      PROPOSER_GAS_REFUND
    );

    // Enable incentives in aTokens and Variable Debt tokens
    incentivesController.configureAssets(assets, emissions);

    // Sets the end date for the distribution
    incentivesController.setDistributionEnd(block.timestamp + DISTRIBUTION_DURATION);
  }
}