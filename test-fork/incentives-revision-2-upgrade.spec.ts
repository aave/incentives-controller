import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { constants } from 'ethers';
import rawHRE from 'hardhat';
import { deployAaveIncentivesController, deploySelfDestruct } from '../helpers/contracts-accessors';
import { DRE, impersonateAccountsHardhat, increaseTime } from '../helpers/misc-utils';
import { getUserIndex } from '../test/DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../test/DistributionManager/data-helpers/base-math';
import {
  IAaveIncentivesController,
  IERC20,
  ILendingPool,
  ILendingPoolAddressesProvider,
  InitializableAdminUpgradeabilityProxy,
  StakedTokenIncentivesController,
} from '../types';

const AAVE_LENDING_POOL_ADDRESSES_PROVIDER = '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5';
const AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';
const INCENTIVES_PROXY_ADMIN = AAVE_LENDING_POOL_ADDRESSES_PROVIDER;

const AAVE_DAI_TOKEN = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
const DAI_TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const DAI_WHALE = '0x1e3d6eab4bcf24bcd04721caa11c478a2e59852d';
const STAKED_AAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';

describe('Upgrade to and test Revision #2 of the implementation', () => {
  let ethers;

  let incentives: IAaveIncentivesController, pool: ILendingPool;
  let aDai: IERC20, dai: IERC20, stkAave: IERC20;
  let claimer: SignerWithAddress, daiWhale: JsonRpcSigner;

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = DRE.ethers;
    [claimer] = await ethers.getSigners();

    // Define ERC20 tokens
    aDai = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/protocol/tokenization/AToken.sol:AToken',
      AAVE_DAI_TOKEN
    )) as IERC20;
    dai = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      DAI_TOKEN
    )) as IERC20;
    stkAave = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      STAKED_AAVE
    )) as IERC20;

    // Define system contracts
    incentives = (await ethers.getContractAt(
      'StakedTokenIncentivesController',
      INCENTIVES_PROXY
    )) as IAaveIncentivesController;
    const incentivesProxy = (await ethers.getContractAt(
      'InitializableAdminUpgradeabilityProxy',
      INCENTIVES_PROXY
    )) as InitializableAdminUpgradeabilityProxy;
    const poolAddressesProvider = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol:ILendingPoolAddressesProvider',
      AAVE_LENDING_POOL_ADDRESSES_PROVIDER
    )) as ILendingPoolAddressesProvider;
    pool = (await ethers.getContractAt(
      'ILendingPool',
      await poolAddressesProvider.getLendingPool()
    )) as ILendingPool;

    // Spoof signers for the necessary accounts
    await impersonateAccountsHardhat([INCENTIVES_PROXY_ADMIN, DAI_WHALE]);
    const incentivesProxyAdmin = ethers.provider.getSigner(INCENTIVES_PROXY_ADMIN);
    daiWhale = ethers.provider.getSigner(DAI_WHALE);

    // Seed the impersonated accounts with some ETH for gas
    for (const ethBeneficiary of [INCENTIVES_PROXY_ADMIN, DAI_WHALE]) {
      const selfDestructContract = await deploySelfDestruct();
      await selfDestructContract.destroyAndTransfer(ethBeneficiary, {
        value: ethers.utils.parseEther('10'),
      });
    }

    // Deploy next incentives implementation
    const { address: nextIncentivesImplementation } = await deployAaveIncentivesController([
      STAKED_AAVE,
      AAVE_SHORT_EXECUTOR,
    ]);

    // Upgrade the incentives proxy use the new implementation
    await incentivesProxy.connect(incentivesProxyAdmin).upgradeTo(nextIncentivesImplementation);
  });

  it('continues to accrue rewards correctly, and allows aToken holder to claim incentives using claimRewardsToSelf()', async () => {
    const rewardsAssets = [aDai.address];

    // Rewards should be accruing for aDai
    expect((await incentives.getAssetData(aDai.address))[1]).to.be.gt(0);

    // Claim all rewards to zero out previously-accrued rewards
    await incentives.connect(claimer).claimRewardsToSelf(rewardsAssets, constants.MaxUint256);

    // Seed claimer with DAI
    const daiDepositAmount = ethers.utils.parseEther('10000');
    await dai.connect(daiWhale).transfer(claimer.address, daiDepositAmount);

    // Deposit DAI for aDAI
    await dai.connect(claimer).approve(pool.address, daiDepositAmount);
    await pool.connect(claimer).deposit(dai.address, daiDepositAmount, claimer.address, 0);
    expect(await aDai.balanceOf(claimer.address)).to.be.gt(0);

    // Wait for some time to accrue rewards
    await increaseTime(86400);
    expect(await incentives.getRewardsBalance(rewardsAssets, claimer.address)).to.be.gt(0);

    // Checkpoint claimer data prior to claim
    const aTokenBalance = await aDai.connect(claimer).scaledBalanceOf(claimer.address);
    const stkAaveBalanceBefore = await stkAave.balanceOf(claimer.address);
    const userIndexBefore = await getUserIndex(
      incentives as StakedTokenIncentivesController,
      claimer.address,
      aDai.address
    );

    // Claim rewards to self
    const tx = await incentives
      .connect(claimer)
      .claimRewardsToSelf(rewardsAssets, constants.MaxUint256);

    // Checkpoint claimer data post-claim
    const stkAaveBalanceAfter = await stkAave.balanceOf(claimer.address);
    const userIndexAfter = await getUserIndex(
      incentives as StakedTokenIncentivesController,
      claimer.address,
      aDai.address
    );

    // Assert the correct event emission
    expect(tx).to.emit(incentives, 'RewardsClaimed');

    // Assert the rewards accrued as expected
    expect(stkAaveBalanceAfter).to.be.gt(stkAaveBalanceBefore);
    const expectedAccruedRewards = getRewards(
      aTokenBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();
    expect(stkAaveBalanceAfter.sub(stkAaveBalanceBefore)).to.be.eq(expectedAccruedRewards);
  });
});
