import { timeLatest, waitForTx } from '../../helpers/misc-utils';

import { expect } from 'chai';

import { makeSuite } from '../helpers/make-suite';
import { deployAaveIncentivesController } from '../../helpers/contracts-accessors';
import { MAX_UINT_AMOUNT, RANDOM_ADDRESSES, ZERO_ADDRESS } from '../../helpers/constants';

makeSuite('AaveIncentivesController misc tests', (testEnv) => {
  it('constructor should assign correct params', async () => {
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

  it('Should return same index while multiple asset index updates', async () => {
    const { aDaiMock, aaveIncentivesController, users } = testEnv;
    await waitForTx(await aaveIncentivesController.configureAssets([aDaiMock.address], ['100']));
    await waitForTx(await aDaiMock.doubleHandleActionOnAic(users[1].address, '2000', '100'));
  });

  it('Should overflow index if passed a large emission', async () => {
    const { aDaiMock, aaveIncentivesController, users } = testEnv;
    const MAX_104_UINT = '20282409603651670423947251286015';

    await waitForTx(
      await aaveIncentivesController.configureAssets([aDaiMock.address], [MAX_104_UINT])
    );
    await expect(
      aDaiMock.doubleHandleActionOnAic(users[1].address, '2000', '100')
    ).to.be.revertedWith('Index overflow');
  });

  it('Should configureAssets revert if parameters length does not match', async () => {
    const { aDaiMock, aaveIncentivesController } = testEnv;

    await expect(
      aaveIncentivesController.configureAssets([aDaiMock.address], ['1', '2'])
    ).to.be.revertedWith('INVALID_CONFIGURATION');
  });

  it('Should configureAssets revert if emission parameter overflows uin104', async () => {
    const { aDaiMock, aaveIncentivesController } = testEnv;

    await expect(
      aaveIncentivesController.configureAssets([aDaiMock.address], [MAX_UINT_AMOUNT])
    ).to.be.revertedWith('INVALID_CONFIGURATION');
  });

  it('Should REWARD_TOKEN getter returns the stake token address to keep old interface compatibility', async () => {
    const { aaveIncentivesController, stakedAave } = testEnv;
    await expect(await aaveIncentivesController.REWARD_TOKEN()).to.be.equal(stakedAave.address);
  });

  it('Should claimRewards revert if to argument is ZERO_ADDRESS', async () => {
    const { aaveIncentivesController, users, aDaiMock, stakedAave } = testEnv;
    const [userWithRewards] = users;

    await waitForTx(await aaveIncentivesController.configureAssets([aDaiMock.address], ['2000']));
    await waitForTx(await aDaiMock.setUserBalanceAndSupply('300000', '30000'));

    // Claim from third party claimer
    await expect(
      aaveIncentivesController
        .connect(userWithRewards.signer)
        .claimRewards([aDaiMock.address], MAX_UINT_AMOUNT, ZERO_ADDRESS)
    ).to.be.revertedWith('INVALID_TO_ADDRESS');
  });
});
