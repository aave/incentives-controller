import { Signer } from 'ethers/lib/ethers';
import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import {
  IERC20Detailed__factory,
  ILendingPoolData__factory,
  VariableDebtToken__factory,
} from '../../types';

task('deploy-var-debt-token', 'Deploy AToken using prior reserve config')
  .addParam('pool')
  .addParam('asset')
  .addParam('incentivesController')
  .addOptionalParam('tokenName')
  .addOptionalParam('tokenSymbol')
  .addFlag('defender')
  .setAction(
    async ({ defender, pool, asset, incentivesController, tokenName, tokenSymbol }, localBRE) => {
      await localBRE.run('set-DRE');

      let deployer: Signer;
      [deployer] = await localBRE.ethers.getSigners();

      if (defender) {
        const { signer } = await getDefenderRelaySigner();
        deployer = signer;
      }

      const { variableDebtTokenAddress } = await ILendingPoolData__factory.connect(
        pool,
        deployer
      ).getReserveData(asset);

      if (!tokenSymbol && variableDebtTokenAddress === ZERO_ADDRESS) {
        throw new Error(
          "Reserve does not exists or not initialized. Pass 'tokenSymbol' as param to the task.'"
        );
      }
      if (!tokenName && variableDebtTokenAddress === ZERO_ADDRESS) {
        throw new Error(
          "Reserve does not exists or not initialized. Pass 'tokenName' as param to the task.'"
        );
      }

      // Grab same name and symbol from old implementation
      if (!tokenName) {
        tokenName = await IERC20Detailed__factory.connect(
          variableDebtTokenAddress,
          deployer
        ).name();
      }
      if (!tokenSymbol) {
        tokenSymbol = await IERC20Detailed__factory.connect(
          variableDebtTokenAddress,
          deployer
        ).symbol();
      }

      const { address } = await new VariableDebtToken__factory(deployer).deploy(
        pool,
        asset,
        tokenName,
        tokenSymbol,
        incentivesController
      );

      return address;
    }
  );
