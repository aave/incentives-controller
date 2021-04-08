import { Signer } from 'ethers';
import {
  MAX_UINT_AMOUNT,
} from '../../helpers/constants';
import {
  deployAaveIncentivesController,
} from '../../helpers/contracts-accessors';
import { insertContractAddressInDb } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { eContractid } from '../../helpers/types';
import { MintableErc20 } from '../../types/MintableErc20';

export const testDeployIncentivesController = async (
  deployer: Signer,
  vaultOfRewards: Signer,
) => {

  const emissionManager = await deployer.getAddress();
  const incentivesController = await deployAaveIncentivesController([
    stakedAaveProxy.address,
    emissionManager
  ]);

  await insertContractAddressInDb(eContractid.AaveIncentivesController, incentivesController.address);

  
  return incentivesController;
};
