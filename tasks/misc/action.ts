import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { IncentivesControllerProxy__factory, PullRewardsIncentivesController__factory } from '../../types';

task('action', 'Review rewards')
    .addParam('proxy', 'controller proxy address')
    .addParam('asset')
    .setAction(async ({ proxy, user, asset }, localBRE) => {
        await localBRE.run('set-DRE');
        const signer = await getFirstSigner();

        const controllerProxy = IncentivesControllerProxy__factory
            .connect(proxy, signer);

        await waitForTx(
            await controllerProxy.handleActionFoo(
                signer.address,
                1000000,
                10000,
                asset,
            )
        )
    });
