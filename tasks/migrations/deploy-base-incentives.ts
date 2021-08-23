import { isAddress } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployBaseIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { waitForTx } from '../../helpers/misc-utils';

task(`deploy-base-incentives`, `Deploy and initializes the BaseIncentivesController contract`)
  .addFlag('verify')
  .addParam('rewardToken')
  .addParam('rewardsVault')
  .addParam('emissionManager')
  .addParam('proxyAdmin', `The address to be added as an Admin role at the Transparent Proxy.`)
  .setAction(
    async ({ verify, rewardToken, rewardsVault, emissionManager, proxyAdmin }, localBRE) => {
      await localBRE.run('set-DRE');
      if (!isAddress(proxyAdmin)) {
        throw Error('Missing or incorrect admin param');
      }
      if (!isAddress(rewardToken)) {
        throw Error('Missing or incorrect rewardToken param');
      }
      if (!isAddress(rewardsVault)) {
        throw Error('Missing or incorrect rewardsVault param');
      }
      emissionManager = isAddress(emissionManager) ? emissionManager : ZERO_ADDRESS;

      console.log(`[BaseIncentivesController] Starting deployment:`);

      const incentivesControllerImpl = await deployBaseIncentivesController(
        [rewardToken, emissionManager],
        verify
      );
      console.log(`  - Deployed implementation of BaseIncentivesController`);

      const incentivesProxy = await deployInitializableAdminUpgradeabilityProxy(verify);
      console.log(`  - Deployed proxy of BaseIncentivesController`);

      const encodedParams = incentivesControllerImpl.interface.encodeFunctionData('initialize', [
        rewardsVault,
      ]);

      await waitForTx(
        await incentivesProxy.functions['initialize(address,address,bytes)'](
          incentivesControllerImpl.address,
          proxyAdmin,
          encodedParams
        )
      );
      console.log(`  - Initialized  BaseIncentivesController Proxy`);

      console.log(`  - Finished BaseIncentivesController deployment and initialization`);
      console.log(`    - Proxy: ${incentivesProxy.address}`);
      console.log(`    - Impl: ${incentivesControllerImpl.address}`);

      return {
        proxy: incentivesProxy.address,
        implementation: incentivesControllerImpl.address,
      };
    }
  );
