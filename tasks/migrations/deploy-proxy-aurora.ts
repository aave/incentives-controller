import { task } from 'hardhat/config';
import { deployInitializableAdminUpgradeabilityProxy, deployPullRewardsIncentivesController } from '../../helpers/contracts-accessors';
import { getFirstSigner, getSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { BaseIncentivesController, BaseIncentivesController__factory, IncentivesControllerProxy__factory, InitializableAdminUpgradeabilityProxy } from '../../types';

task('deploy:proxy', 'deploy incentives controller impls and proxy')
    .addParam('token1')
    .addParam('token2')
    .addParam('vault1')
    .addParam('vault2')
    .addFlag('verify')
    .setAction(async (params, localBRE) => {
        const {
            token1,
            token2,
            vault1,
            vault2,
            verify,
        } = params;
        const vaults = [vault1, vault2];

        await localBRE.run('set-DRE');

        const deployer = await getFirstSigner();
        const proxyAdmin = await (await getSigner(1)).getAddress();
        const emissionManager = deployer.address;

        // 1. deploy controller impls
        const contractProxies: InitializableAdminUpgradeabilityProxy[] = [];
        contractProxies.push(await deployIncentivesController(
            token1,
            vault1,
            emissionManager,
            proxyAdmin,
            verify,
        ));
        contractProxies.push(await deployIncentivesController(
            token2,
            vault2,
            emissionManager,
            proxyAdmin,
            verify,
        ));

        // 2. deploy controller proxy

        const controllerProxy = await new IncentivesControllerProxy__factory(deployer)
            .deploy(contractProxies.map(p => p.address));
        await controllerProxy.deployTransaction.wait();

        console.log(`Controller Proxy deployed at ${controllerProxy.address}`);

        // 3. config controller impl

        for (const proxy of contractProxies) {
            const controller = BaseIncentivesController__factory
                .connect(proxy.address, deployer);
            await controller
                .setProxy(controllerProxy.address);
        }
        console.log('controller proxy set');
    });

async function deployIncentivesController (
    token: string, 
    vault: string, 
    emissionManager: string, 
    proxyAdmin: string,
    verify: boolean,
) {
    const impl = await deployPullRewardsIncentivesController(
        [token, emissionManager],
        verify
    );
    console.log('controller impls deployed');

    const proxy = await deployInitializableAdminUpgradeabilityProxy(verify);
    console.log('contract proxies deployed');

    const params = impl.interface.encodeFunctionData(
        'initialize',
        [vault],
    );

    await waitForTx(
        await proxy.functions['initialize(address,address,bytes)'](
            impl.address,
            proxyAdmin,
            params 
        )
    );

    console.log(`Initialized PullRewardsIncentivesController`);
    console.log(`  - Token: ${token}, vault: ${vault}`);
    console.log(`  - Contract proxy: ${proxy.address}`);
    console.log(`  - Impl: ${impl.address}`);
    console.log(`  - Proxy Admin: ${proxyAdmin}`);
    console.log(`  - Emission Manager: ${emissionManager}`);

    return proxy;
}
