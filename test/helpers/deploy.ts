import {
  deployStakedTokenStrategy,
  deployPullRewardsStrategy,
} from './../../helpers/contracts-accessors';
import { Signer } from 'ethers';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployAaveIncentivesController,
  deployAaveIncentivesControllerV2,
  deployInitializableAdminUpgradeabilityProxy,
  deployMintableErc20,
} from '../../helpers/contracts-accessors';
import { getFirstSigner, insertContractAddressInDb } from '../../helpers/contracts-helpers';
import { verifyContract } from '../../helpers/etherscan-verification';
import { eContractid, tEthereumAddress } from '../../helpers/types';
import { MintableErc20, StakedAaveV3__factory } from '../../types';

export const COOLDOWN_SECONDS = '3600'; // 1 hour in seconds
export const UNSTAKE_WINDOW = '1800'; // 30 min in second

export const testDeployIncentivesController = async (
  emissionManager: Signer,
  vaultOfRewards: Signer,
  proxyAdmin: Signer,
  aaveToken: MintableErc20
) => {
  const emissionManagerAddress = await emissionManager.getAddress();
  // Deploy proxies and implementations
  const stakeProxy = await deployInitializableAdminUpgradeabilityProxy();
  const incentivesProxy = await deployInitializableAdminUpgradeabilityProxy();

  const aaveStakeV3 = await deployStakedAaveV3([
    aaveToken.address,
    aaveToken.address,
    COOLDOWN_SECONDS,
    UNSTAKE_WINDOW,
    await vaultOfRewards.getAddress(),
    emissionManagerAddress,
    (1000 * 60 * 60).toString(),
  ]);

  const incentivesImplementation = await deployAaveIncentivesController([
    stakeProxy.address,
    emissionManagerAddress,
  ]);

  // Initialize proxies
  const aaveStakeInit = aaveStakeV3.interface.encodeFunctionData(
    // @ts-ignore
    'initialize(address,address,address,uint256,string,string,uint8)',
    [
      emissionManagerAddress,
      emissionManagerAddress,
      emissionManagerAddress,
      '2000',
      'Staked AAVE',
      'stkAAVE',
      '18',
    ]
  );
  const incentivesInit = incentivesImplementation.interface.encodeFunctionData('initialize');

  await (
    await stakeProxy['initialize(address,address,bytes)'](
      aaveStakeV3.address,
      await proxyAdmin.getAddress(),
      aaveStakeInit
    )
  ).wait();
  await (
    await incentivesProxy['initialize(address,address,bytes)'](
      incentivesImplementation.address,
      await proxyAdmin.getAddress(),
      incentivesInit
    )
  ).wait();

  await insertContractAddressInDb(eContractid.AaveIncentivesController, incentivesProxy.address);

  return { incentivesProxy, stakeProxy };
};

export const testDeployIncentivesControllerV2 = async (
  emissionManagerSigner: Signer,
  vaultOfRewards: Signer,
  proxyAdmin: Signer,
  stakeToken: tEthereumAddress
) => {
  const emissionManager = await emissionManagerSigner.getAddress();

  // Deploy proxy and implementations
  const incentivesProxy = await deployInitializableAdminUpgradeabilityProxy();
  const incentivesImplementation = await deployAaveIncentivesControllerV2([emissionManager]);
  const pullRewardsStrategy = await deployPullRewardsStrategy(await vaultOfRewards.getAddress());
  const stakedTokenStrategy = await deployStakedTokenStrategy(stakeToken);
  // Initialize proxy
  const incentivesInit = incentivesImplementation.interface.encodeFunctionData('initialize');

  await (
    await incentivesProxy['initialize(address,address,bytes)'](
      incentivesImplementation.address,
      await proxyAdmin.getAddress(),
      incentivesInit
    )
  ).wait();

  await insertContractAddressInDb(eContractid.AaveIncentivesController, incentivesProxy.address);

  return { incentivesProxy, pullRewardsStrategy, stakedTokenStrategy };
};

export const deployStakedAaveV3 = async (
  [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
  ]: [
    tEthereumAddress,
    tEthereumAddress,
    string,
    string,
    tEthereumAddress,
    tEthereumAddress,
    string
  ],
  verify?: boolean
) => {
  const id = eContractid.StakedAaveV3;
  const args: string[] = [
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    ZERO_ADDRESS, // gov address
  ];
  const instance = await new StakedAaveV3__factory(await getFirstSigner()).deploy(
    stakedToken,
    rewardsToken,
    cooldownSeconds,
    unstakeWindow,
    rewardsVault,
    emissionManager,
    distributionDuration,
    ZERO_ADDRESS // gov address);
  );
  if (verify) {
    await verifyContract(instance.address, args);
  }
  return instance;
};
