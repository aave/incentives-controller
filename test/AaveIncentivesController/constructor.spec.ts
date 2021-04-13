import { timeLatest } from '../../helpers/misc-utils';

const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { deployAaveIncentivesController } from '../../helpers/contracts-accessors';
import { RANDOM_ADDRESSES } from '../../helpers/constants';

makeSuite('AaveIncentivesController constructor tests', () => {
  it('should assign correct params', async () => {
    const peiEmissionManager = RANDOM_ADDRESSES[1];
    const psm = RANDOM_ADDRESSES[5];

    const aaveIncentivesController = await deployAaveIncentivesController([
      psm,
      peiEmissionManager,
    ]);
    await expect(await aaveIncentivesController.STAKE_TOKEN()).to.be.equal(psm);
    await expect((await aaveIncentivesController.EMISSION_MANAGER()).toString()).to.be.equal(
      peiEmissionManager
    );
  });
});
