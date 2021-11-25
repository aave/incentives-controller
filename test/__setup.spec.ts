import rawBRE from 'hardhat';
import { Signer, ethers } from 'ethers';
import { getBlockTimestamp, getEthersSigners } from '../helpers/contracts-helpers';
import { initializeMakeSuite } from './helpers/make-suite';
import { deployMintableErc20, deployATokenMock } from '../helpers/contracts-accessors';
import { DRE, waitForTx } from '../helpers/misc-utils';
import { MintableErc20 } from '../types/MintableErc20';
import { testDeployIncentivesController, testDeployIncentivesControllerV2 } from './helpers/deploy';
import {
  IncentivesControllerV2__factory,
  PullRewardsIncentivesController,
  PullRewardsIncentivesController__factory,
  StakedAaveV3__factory,
  StakedTokenIncentivesController__factory,
} from '../types';
import { parseEther } from '@ethersproject/units';
import { MAX_UINT_AMOUNT } from '../helpers/constants';

const topUpWalletsWithAave = async (
  wallets: Signer[],
  aaveToken: MintableErc20,
  amount: string
) => {
  for (const wallet of wallets) {
    await waitForTx(await aaveToken.connect(wallet).mint(amount));
  }
};

const buildTestEnv = async (
  deployer: Signer,
  vaultOfRewards: Signer,
  proxyAdmin: Signer,
  restWallets: Signer[]
) => {
  console.time('setup');

  const aaveToken = await deployMintableErc20(['Aave', 'aave']);
  const rewardToken = await deployMintableErc20(['Reward', 'REW']);

  await waitForTx(await aaveToken.connect(vaultOfRewards).mint(ethers.utils.parseEther('3000000')));
  await waitForTx(
    await rewardToken.connect(vaultOfRewards).mint(ethers.utils.parseEther('2000000'))
  );
  await topUpWalletsWithAave(
    [restWallets[0], restWallets[1], restWallets[2], restWallets[3], restWallets[4]],
    aaveToken,
    ethers.utils.parseEther('100').toString()
  );

  const { incentivesProxy, stakeProxy } = await testDeployIncentivesController(
    deployer,
    vaultOfRewards,
    proxyAdmin,
    aaveToken
  );
  const {
    incentivesProxy: incentivesProxyV2,
    pullRewardsStrategy,
    stakedTokenStrategy,
  } = await testDeployIncentivesControllerV2(
    deployer,
    vaultOfRewards,
    proxyAdmin,
    stakeProxy.address
  );

  const { proxy: baseIncentivesProxy } = await DRE.run('deploy-pull-rewards-incentives', {
    emissionManager: await deployer.getAddress(),
    rewardToken: aaveToken.address,
    rewardsVault: await vaultOfRewards.getAddress(),
    proxyAdmin: await proxyAdmin.getAddress(),
  });

  await waitForTx(
    await aaveToken.connect(vaultOfRewards).approve(baseIncentivesProxy, MAX_UINT_AMOUNT)
  );

  const distributionDuration = ((await getBlockTimestamp()) + 1000 * 60 * 60).toString();
  await deployATokenMock(incentivesProxy.address, 'aDai');
  await deployATokenMock(incentivesProxy.address, 'aWeth');
  await deployATokenMock(incentivesProxyV2.address, 'aDaiV2');
  await deployATokenMock(incentivesProxyV2.address, 'aWethV2');

  await deployATokenMock(baseIncentivesProxy, 'aDaiBase');
  await deployATokenMock(baseIncentivesProxy, 'aWethBase');

  const incentivesController = StakedTokenIncentivesController__factory.connect(
    incentivesProxy.address,
    deployer
  );
  const incentivesControllerV2 = IncentivesControllerV2__factory.connect(
    incentivesProxyV2.address,
    deployer
  );
  const pullRewardsIncentivesController = PullRewardsIncentivesController__factory.connect(
    baseIncentivesProxy,
    deployer
  );

  await incentivesController.setDistributionEnd(distributionDuration);
  await pullRewardsIncentivesController.setDistributionEnd(distributionDuration);
  await waitForTx(
    await aaveToken
      .connect(vaultOfRewards)
      .transfer(incentivesController.address, parseEther('1000000'))
  );
  await waitForTx(
    await aaveToken
      .connect(vaultOfRewards)
      .transfer(incentivesProxyV2.address, parseEther('1000000'))
  );

  console.timeEnd('setup');

  return {
    aaveToken,
    rewardToken,
    incentivesController,
    incentivesControllerV2,
    pullRewardsStrategy,
    stakedTokenStrategy,
    pullRewardsIncentivesController,
    aaveStake: StakedAaveV3__factory.connect(stakeProxy.address, deployer),
  };
};

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, proxyAdmin, rewardVault, ...restWallets] = await getEthersSigners();
  const {
    aaveToken,
    aaveStake,
    incentivesController,
    incentivesControllerV2,
    pullRewardsStrategy,
    stakedTokenStrategy,
    rewardToken,
    pullRewardsIncentivesController,
  } = await buildTestEnv(deployer, rewardVault, proxyAdmin, restWallets);
  await initializeMakeSuite(
    aaveToken,
    aaveStake,
    incentivesController,
    incentivesControllerV2,
    pullRewardsStrategy,
    stakedTokenStrategy,
    rewardToken,
    pullRewardsIncentivesController
  );
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
