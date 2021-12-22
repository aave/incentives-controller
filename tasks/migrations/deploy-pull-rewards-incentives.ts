import { isAddress } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployPullRewardsIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { getFirstSigner, getSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';

task(
  `deploy-pull-rewards-incentives`,
  `Deploy and initializes the PullRewardsIncentivesController contract`
)
  .addFlag('verify')
  .addParam('token')
  .addParam('vault')
  .setAction(
    async ({ verify, token, vault }, localBRE) => {
      await localBRE.run('set-DRE');
      const deployer = await getFirstSigner();
      const proxyAdmin = await (await getSigner(1)).getAddress();
      const emissionManager = deployer.address;
      if (!isAddress(token)) {
        throw Error('Missing or incorrect rewardToken param');
      }
      if (!isAddress(vault)) {
        throw Error('Missing or incorrect rewardsVault param');
      }

      console.log(`[PullRewardsIncentivesController] Starting deployment:`);

      const incentivesControllerImpl = await deployPullRewardsIncentivesController(
        [token, emissionManager],
        verify
      );
      console.log(`  - Deployed implementation of PullRewardsIncentivesController`);

      const incentivesProxy = await deployInitializableAdminUpgradeabilityProxy(verify);
      console.log(`  - Deployed proxy of PullRewardsIncentivesController`);

      const encodedParams = incentivesControllerImpl.interface.encodeFunctionData('initialize', [
        vault,
      ]);

      await waitForTx(
        await incentivesProxy.functions['initialize(address,address,bytes)'](
          incentivesControllerImpl.address,
          proxyAdmin,
          encodedParams
        )
      );
      console.log(`  - Initialized  PullRewardsIncentivesController Proxy`);

      console.log(`  - Finished PullRewardsIncentivesController deployment and initialization`);
      console.log(`    - Proxy: ${incentivesProxy.address}`);
      console.log(`    - Impl: ${incentivesControllerImpl.address}`);
      console.log(`    - Proxy Admin is ${proxyAdmin}`);
      console.log(`    - Emission Manager is ${emissionManager}`);

      return {
        proxy: incentivesProxy.address,
        implementation: incentivesControllerImpl.address,
      };
    }
  );
