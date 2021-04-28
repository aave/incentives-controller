import rawBRE from 'hardhat';
import { Signer, ethers } from 'ethers';
import { getBlockTimestamp, getEthersSigners } from '../helpers/contracts-helpers';
import { initializeMakeSuite } from './helpers/make-suite';
import { deployMintableErc20, deployATokenMock } from '../helpers/contracts-accessors';
import { waitForTx } from '../helpers/misc-utils';
import { MintableErc20 } from '../types/MintableErc20';
import { testDeployIncentivesController } from './helpers/deploy';
import { StakedAaveV3__factory, StakedTokenIncentivesController__factory } from '../types';
import { parseEther } from '@ethersproject/units';

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

  await waitForTx(await aaveToken.connect(vaultOfRewards).mint(ethers.utils.parseEther('1000000')));
  await topUpWalletsWithAave(
    [restWallets[0], restWallets[1], restWallets[2], restWallets[3], restWallets[4]],
    aaveToken,
    ethers.utils.parseEther('100').toString()
  );

  const { incentivesProxy, stakeProxy } = await testDeployIncentivesController(
    vaultOfRewards,
    proxyAdmin,
    aaveToken
  );
  const distributionDuration = ((await getBlockTimestamp()) + 1000 * 60 * 60).toString();
  await deployATokenMock(incentivesProxy.address, 'aDai');
  await deployATokenMock(incentivesProxy.address, 'aWeth');

  const incentivesController = StakedTokenIncentivesController__factory.connect(
    incentivesProxy.address,
    deployer
  );
  await incentivesController.setDistributionEnd(distributionDuration);
  await waitForTx(
    await aaveToken
      .connect(vaultOfRewards)
      .transfer(incentivesController.address, parseEther('1000000'))
  );

  console.timeEnd('setup');

  return {
    aaveToken,
    incentivesController,
    aaveStake: StakedAaveV3__factory.connect(stakeProxy.address, deployer),
  };
};

before(async () => {
  await rawBRE.run('set-DRE');
  const [deployer, proxyAdmin, ...restWallets] = await getEthersSigners();
  const { aaveToken, aaveStake, incentivesController } = await buildTestEnv(
    deployer,
    deployer,
    proxyAdmin,
    restWallets
  );
  await initializeMakeSuite(aaveToken, aaveStake, incentivesController);
  console.log('\n***************');
  console.log('Setup and snapshot finished');
  console.log('***************\n');
});
