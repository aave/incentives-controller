import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { ATokenFactory } from '../../types/ATokenFactory';
import { IERC20DetailedFactory } from '../../types/IERC20DetailedFactory';
import { ILendingPoolDataFactory } from '../../types/ILendingPoolDataFactory';

task('deploy-atoken', 'Deploy AToken using prior reserve config')
  .addParam('pool')
  .addParam('asset')
  .addParam('treasury')
  .addParam('incentivesController')
  .addOptionalParam('tokenName')
  .addOptionalParam('tokenSymbol')
  .setAction(
    async ({ pool, asset, treasury, incentivesController, tokenName, tokenSymbol }, localBRE) => {
      await localBRE.run('set-DRE');
      const [deployer] = await localBRE.ethers.getSigners();

      const { aTokenAddress } = await ILendingPoolDataFactory.connect(
        pool,
        deployer
      ).getReserveData(asset);

      if (!tokenSymbol && aTokenAddress === ZERO_ADDRESS) {
        throw new Error(
          "Reserve does not exists or not initialized. Pass 'tokenSymbol' as param to the task.'"
        );
      }
      if (!tokenName && aTokenAddress === ZERO_ADDRESS) {
        throw new Error(
          "Reserve does not exists or not initialized. Pass 'tokenName' as param to the task.'"
        );
      }

      // Grab same name and symbol from old implementation
      if (!tokenName) {
        tokenName = await IERC20DetailedFactory.connect(aTokenAddress, deployer).name();
      }
      if (!tokenSymbol) {
        tokenSymbol = await IERC20DetailedFactory.connect(aTokenAddress, deployer).symbol();
      }

      const { address } = await new ATokenFactory(deployer).deploy(
        pool,
        asset,
        treasury,
        tokenName,
        tokenSymbol,
        incentivesController
      );

      return address;
    }
  );
