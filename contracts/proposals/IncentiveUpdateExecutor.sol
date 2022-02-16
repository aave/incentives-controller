// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.7.5;
pragma abicoder v2;

import {DataTypes} from '../utils/DataTypes.sol';
import {IAaveEcosystemReserveController} from '../interfaces/IAaveEcosystemReserveController.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {ILendingPoolData} from '../interfaces/ILendingPoolData.sol';

contract IncentiveUpdateExecutor {

  address constant AAVE_TOKEN = 0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9;
  address constant CONTROLLER_ECO_RESERVE = 0x1E506cbb6721B83B1549fa1558332381Ffa61A93;
  address constant LENDING_POOL = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
  address constant INCENTIVES_CONTROLLER_PROXY_ADDRESS = 0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5;

  uint256 constant DISTRIBUTION_DURATION = 7776000;   // 90 days
  uint256 constant DISTRIBUTION_AMOUNT = 97020 ether;

  uint256 constant PROPOSER_GAS_REFUND = 35 ether;
  address constant PROPOSER_REFUND_ADDRESS = 0x6904110f17feD2162a11B5FA66B188d801443Ea4;
  
  function execute() external {

    IAaveEcosystemReserveController ecosystemReserveController = IAaveEcosystemReserveController(CONTROLLER_ECO_RESERVE);
    IAaveIncentivesController incentivesController = IAaveIncentivesController(INCENTIVES_CONTROLLER_PROXY_ADDRESS);

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

    uint256[] memory emissions = new uint256[](38);

    emissions[0] = 860629828674028;     // aDAI
    emissions[1] = 1721259657348060;    // vDebtDAI
    emissions[2] = 0;                   // aGUSD
    emissions[3] = 0;                   // vDebtGUSD
    emissions[4] = 1903258773510960;    // aUSDC
    emissions[5] = 3806517547021920;    // vDebtUSDC
    emissions[6] = 694765960976989;     // aUSDT
    emissions[7] = 1389531921953980;    // vDebtUSDT
    emissions[8] = 252193044534425;     // aWBTC
    emissions[9] = 0;                   // vDebtWBTC
    emissions[10] = 933007096551141;    // aWETH
    emissions[11] = 0;                  // vDebtWETH
    emissions[12] = 272977322986304;    // aLINK
    emissions[13] = 0;                  // vDebtLINK
    emissions[14] = 23046648361494;     // aSUSD
    emissions[15] = 46093296722988;     // vDebtSUSD
    emissions[16] = 23204645595171;     // aYFI
    emissions[17] = 0;                  // vDebtYFI
    emissions[18] = 28653877437482;     // aXSUSHI
    emissions[19] = 0;                  // vDebtXSUSHI
    emissions[20] = 109957713960904;    // aMKR
    emissions[21] = 0;                  // vDebtMKR
    emissions[22] = 64158288472709;     // aTUSD
    emissions[23] = 128316576945418;    // vDebtTUSD
    emissions[24] = 9846555646706;      // aRAI
    emissions[25] = 19693111293413;     // vDebtRAI
    emissions[26] = 4875116344638;      // aBAL
    emissions[27] = 0;                  // vDebtBAL
    emissions[28] = 9398984935492;      // aUSDP
    emissions[29] = 18797969870985;     // vDebtUSP
    emissions[30] = 8333031502505;      // aFRAX
    emissions[31] = 16666063005009;     // vDebtFRAX
    emissions[32] = 22409965951501;     // aDPI
    emissions[33] = 0;                  // vDebtDPI
    emissions[34] = 21223932856405;     // aBUSD
    emissions[35] = 42447865712811;     // vDebtBUSD
    emissions[36] = 44508547226299;     // aCRV
    emissions[37] = 0;                  // vDebtCRV

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