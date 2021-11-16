import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { tEthereumAddress } from '../helpers/types';
import {
  AaveProtocolDataProvider__factory,
  AToken__factory,
  IERC20__factory,
  ILendingPoolAddressesProvider__factory,
} from '../types';
import { expect } from 'chai';
import { parseUnits } from 'ethers/lib/utils';
import { MAX_UINT_AMOUNT } from '../helpers/constants';
import { DRE } from '../helpers/misc-utils';
import { ILendingPool } from '../types/ILendingPool';
import { Signer } from 'ethers/lib/ethers';

export const spendList = {
  DAI: {
    holder: '0x72aabd13090af25dbb804f84de6280c697ed1150',
    transfer: '1000',
    deposit: '100',
    decimals: '18',
  },
  GUSD: {
    holder: '0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b',
    transfer: '1000',
    deposit: '100',
    decimals: '2',
  },
  USDC: {
    holder: '0xAe2D4617c862309A3d75A0fFB358c7a5009c673F',
    transfer: '1000',
    deposit: '100',
    decimals: '6',
  },
  USDT: {
    holder: '0x9f57dc21f521c64204b6190c3076a05b559b1a28',
    transfer: '1000',
    deposit: '100',
    decimals: '6',
  },
  WBTC: {
    holder: '0x6dab3bcbfb336b29d06b9c793aef7eaa57888922',
    transfer: '1',
    deposit: '0.5',
    decimals: '8',
  },
  WETH: {
    holder: '0x0f4ee9631f4be0a63756515141281a3e2b293bbe',
    transfer: '1',
    deposit: '0.5',
    decimals: '18',
  },
  BUSD: {
    holder: '0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549',
    transfer: '1000',
    deposit: '100',
    decimals: '18',
  },
  FRAX: {
    holder: '0x5E583B6a1686f7Bc09A6bBa66E852A7C80d36F00',
    transfer: '1000',
    deposit: '100',
    decimals: '18',
  },
  DPI: {
    holder: '0x96E3d09A600b15341Cc266820106A1d6B4aa58C2',
    transfer: '1000',
    deposit: '100',
    decimals: '18',
  },
};

export const getReserveConfigs = async (
  poolProviderAddress: tEthereumAddress,
  reserves: string,
  proposer: Signer
) => {
  const poolProvider = await ILendingPoolAddressesProvider__factory.connect(
    poolProviderAddress,
    proposer
  );
  const protocolDataProvider = await AaveProtocolDataProvider__factory.connect(
    await poolProvider.getAddress(
      '0x0100000000000000000000000000000000000000000000000000000000000000'
    ),
    proposer
  );

  const reservesConfigs = (await protocolDataProvider.getAllReservesTokens())
    .filter(({ symbol }) => reserves.includes(symbol))
    .sort(({ symbol: a }, { symbol: b }) => a.localeCompare(b));

  return reservesConfigs;
};

export const fullCycleLendingPool = async (
  symbol: string,
  tokenAddress: string,
  proposer: SignerWithAddress,
  pool: ILendingPool
) => {
  const { aTokenAddress, variableDebtTokenAddress } = await pool.getReserveData(tokenAddress);
  const reserve = IERC20__factory.connect(tokenAddress, proposer);
  const aToken = AToken__factory.connect(aTokenAddress, proposer);
  const holderSigner = DRE.ethers.provider.getSigner(spendList[symbol].holder);

  // Transfer assets to proposer from reserve holder
  await (
    await reserve
      .connect(holderSigner)
      .transfer(
        proposer.address,
        parseUnits(spendList[symbol].transfer, spendList[symbol].decimals)
      )
  ).wait();

  // Amounts
  const depositAmount = parseUnits(spendList[symbol].deposit, spendList[symbol].decimals);
  const borrowAmount = depositAmount.div('10');

  // Deposit to LendingPool
  await (await reserve.connect(proposer).approve(pool.address, depositAmount)).wait();
  const tx1 = await pool
    .connect(proposer)
    .deposit(reserve.address, depositAmount, proposer.address, 0);
  await tx1.wait();
  expect(tx1).to.emit(pool, 'Deposit');

  const protocolDataProvider = await AaveProtocolDataProvider__factory.connect(
    '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
    proposer
  );

  const canBorrow = (await protocolDataProvider.getReserveConfigurationData(reserve.address)).borrowingEnabled;

  if (canBorrow) {
    // Request loan to LendingPool
    const tx2 = await pool.borrow(reserve.address, borrowAmount, '2', '0', proposer.address);
    await tx2.wait();
    expect(tx2).to.emit(pool, 'Borrow');


    // Repay variable loan to LendingPool
    await (await reserve.connect(proposer).approve(pool.address, MAX_UINT_AMOUNT)).wait();
    const tx3 = await pool.repay(reserve.address, MAX_UINT_AMOUNT, '2', proposer.address);
    await tx3.wait();
    expect(tx3).to.emit(pool, 'Repay');
  }

  // Withdraw from LendingPool
  const priorBalance = await reserve.balanceOf(proposer.address);
  await (await aToken.connect(proposer).approve(pool.address, MAX_UINT_AMOUNT)).wait();
  const tx4 = await pool.withdraw(reserve.address, MAX_UINT_AMOUNT, proposer.address);
  await tx4.wait();
  expect(tx4).to.emit(pool, 'Withdraw');

  const afterBalance = await reserve.balanceOf(proposer.address);
  expect(await aToken.balanceOf(proposer.address)).to.be.eq('0');
  expect(afterBalance).to.be.gt(priorBalance);
};
