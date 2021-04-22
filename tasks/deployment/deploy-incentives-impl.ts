import { task } from 'hardhat/config';
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';
import { deployAaveIncentivesController } from '../../helpers/contracts-accessors';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';

// Mainnet addresses
const AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';

task('deploy-incentives-impl', 'Incentives controller implementation deployment').setAction(
  async (_, localBRE) => {
    _;
    await localBRE.run('set-DRE');

    const { signer } = await getDefenderRelaySigner();
    const deployer = signer;

    const incentives = await deployAaveIncentivesController(
      [AAVE_STAKE, AAVE_SHORT_EXECUTOR],
      true,
      deployer
    );
    console.log(`- Incentives implementation address ${incentives.address}`);

    return incentives.address;
  }
);
