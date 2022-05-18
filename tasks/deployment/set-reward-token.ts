import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

task('set-token')
    .addParam('token')
    .addParam('proxy')
    .setAction(async ({ token, proxy }, localBRE) => {
        await localBRE.run('set-DRE');
        const manager = await getFirstSigner();

        const incentivesProxy = PullRewardsIncentivesController__factory
          .connect(proxy, manager);

        await waitForTx(
            await incentivesProxy.setRewardToken(token)
        );

        console.log(`Set to ${token}`);
    });
