import { timeLatest, waitForTx } from '../../helpers/misc-utils';

import { expect } from 'chai';

import { makeSuite } from '../helpers/make-suite';
import { deployBaseIncentivesController } from '../../helpers/contracts-accessors';
import { MAX_UINT_AMOUNT, RANDOM_ADDRESSES, ZERO_ADDRESS } from '../../helpers/constants';

makeSuite('baseIncentivesController misc tests', (testEnv) => {
  it('constructor should assign correct params', async () => {
    const peiEmissionManager = RANDOM_ADDRESSES[1];
    const fakeToken = RANDOM_ADDRESSES[5];

    const baseIncentivesController = await deployBaseIncentivesController([
      fakeToken,
      peiEmissionManager,
    ]);
    await expect(await baseIncentivesController.REWARD_TOKEN()).to.be.equal(fakeToken);
    await expect((await baseIncentivesController.EMISSION_MANAGER()).toString()).to.be.equal(
      peiEmissionManager
    );
  });

  it('Should return same index while multiple asset index updates', async () => {
    const { aDaiBaseMock, baseIncentivesController, users } = testEnv;
    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['100'])
    );
    await waitForTx(await aDaiBaseMock.doubleHandleActionOnAic(users[1].address, '2000', '100'));
  });

  it('Should overflow index if passed a large emission', async () => {
    const { aDaiBaseMock, baseIncentivesController, users } = testEnv;
    const MAX_104_UINT = '20282409603651670423947251286015';

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], [MAX_104_UINT])
    );
    await expect(
      aDaiBaseMock.doubleHandleActionOnAic(users[1].address, '2000', '100')
    ).to.be.revertedWith('Index overflow');
  });

  it('Should configureAssets revert if parameters length does not match', async () => {
    const { aDaiBaseMock, baseIncentivesController } = testEnv;

    await expect(
      baseIncentivesController.configureAssets([aDaiBaseMock.address], ['1', '2'])
    ).to.be.revertedWith('INVALID_CONFIGURATION');
  });

  it('Should configureAssets revert if emission parameter overflows uin104', async () => {
    const { aDaiBaseMock, baseIncentivesController } = testEnv;

    await expect(
      baseIncentivesController.configureAssets([aDaiBaseMock.address], [MAX_UINT_AMOUNT])
    ).to.be.revertedWith('INVALID_CONFIGURATION');
  });

  it('Should REWARD_TOKEN getter returns the stake token address to keep old interface compatibility', async () => {
    const { baseIncentivesController, aaveToken } = testEnv;
    await expect(await baseIncentivesController.REWARD_TOKEN()).to.be.equal(aaveToken.address);
  });

  it('Should claimRewards revert if to argument is ZERO_ADDRESS', async () => {
    const { baseIncentivesController, users, aDaiBaseMock } = testEnv;
    const [userWithRewards] = users;

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['2000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '30000'));

    // Claim from third party claimer
    await expect(
      baseIncentivesController
        .connect(userWithRewards.signer)
        .claimRewards([aDaiBaseMock.address], MAX_UINT_AMOUNT, ZERO_ADDRESS)
    ).to.be.revertedWith('INVALID_TO_ADDRESS');
  });
});
