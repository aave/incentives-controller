import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { VariableDebtTokenFactory } from '../../types';
import { IERC20DetailedFactory } from '../../types/IERC20DetailedFactory';
import { ILendingPoolDataFactory } from '../../types/ILendingPoolDataFactory';

task('deploy-var-debt-token', 'Deploy AToken using prior reserve config')
  .addParam('pool')
  .addParam('asset')
  .addParam('incentivesController')
  .addOptionalParam('tokenName')
  .addOptionalParam('tokenSymbol')
  .setAction(async ({ pool, asset, incentivesController, tokenName, tokenSymbol }, localBRE) => {
    await localBRE.run('set-DRE');
    const [deployer] = await localBRE.ethers.getSigners();

    const { variableDebtTokenAddress } = await ILendingPoolDataFactory.connect(
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
      tokenName = await IERC20DetailedFactory.connect(variableDebtTokenAddress, deployer).name();
    }
    if (!tokenSymbol) {
      tokenSymbol = await IERC20DetailedFactory.connect(
        variableDebtTokenAddress,
        deployer
      ).symbol();
    }

    const { address } = await new VariableDebtTokenFactory(deployer).deploy(
      pool,
      asset,
      tokenName,
      tokenSymbol,
      incentivesController
    );

    return address;
  });
