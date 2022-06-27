import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { IncentivesControllerProxy__factory, PullRewardsIncentivesController__factory } from '../../types';

task('controllers', 'Review rewards')
    .addParam('proxy', 'controller proxy address')
    .setAction(async ({ proxy, user, asset }, localBRE) => {
        await localBRE.run('set-DRE');
        const signer = await getFirstSigner();

        const controllerProxy = IncentivesControllerProxy__factory
            .connect(proxy, signer);

        const len = await controllerProxy.foo();
        console.log('len', len.toNumber());

        const controllers = await controllerProxy.viewControllers();
        console.log(controllers);
    });
