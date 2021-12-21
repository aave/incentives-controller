import { task } from 'hardhat/config';
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';
import { deployAaveIncentivesController } from '../../helpers/contracts-accessors';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { getFirstSigner } from '../../helpers/contracts-helpers';

// TODO aurora
const AAVE_STAKE = '0xB5AE3e2883934457cb593793f034b401867e1372'; // WETH for aurora
const AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';

task('deploy-incentives-impl', 'Incentives controller implementation deployment').setAction(
  async (_, localBRE) => {
    _;
    await localBRE.run('set-DRE');

    // const { signer } = await getDefenderRelaySigner();
    // const deployer = signer;
    const deployer = await getFirstSigner();

    const incentives = await deployAaveIncentivesController(
      [AAVE_STAKE, AAVE_SHORT_EXECUTOR],
      true,
      deployer
    );
    console.log(`- Incentives implementation address ${incentives.address}`);

    return incentives.address;
  }
);
