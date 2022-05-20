import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

task('claim', 'claim rewards')
    .addParam('proxy', 'controller proxy')
    .addParam('asset')
    .addParam('amount')
    .setAction(async ({ proxy, asset, amount }, localBRE) => {
        await localBRE.run('set-DRE');
        const signer = await getFirstSigner();

        const incentivesProxy = PullRewardsIncentivesController__factory
          .connect(proxy, signer);

        const rewardToken = await incentivesProxy.REWARD_TOKEN();
        console.log(`reward token ${rewardToken}`);

        await waitForTx(
            await incentivesProxy.claimRewardsToSelf(
                [asset],
                amount,
            )
        );

        console.log('done');
    });
