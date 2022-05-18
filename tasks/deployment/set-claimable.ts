import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

task('set-claimable')
    .addFlag('off')
    .addParam('proxy')
    .setAction(async ({ off, proxy }, localBRE) => {
        await localBRE.run('set-DRE');
        const manager = await getFirstSigner();

        const incentivesProxy = PullRewardsIncentivesController__factory
          .connect(proxy, manager);

        const claimable = !off;

        await waitForTx(
            await incentivesProxy.setClaimable(claimable)
        );

        console.log(`Set to ${claimable}`);
    });
