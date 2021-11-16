import { timeLatest, waitForTx } from '../../helpers/misc-utils';

import { expect } from 'chai';

import { makeSuite } from '../helpers/make-suite';
import { deployPullRewardsIncentivesController } from '../../helpers/contracts-accessors';
import { MAX_UINT_AMOUNT, RANDOM_ADDRESSES, ZERO_ADDRESS } from '../../helpers/constants';

makeSuite('pullRewardsIncentivesController misc tests', (testEnv) => {
  it('constructor should assign correct params', async () => {
    const peiEmissionManager = RANDOM_ADDRESSES[1];
    const fakeToken = RANDOM_ADDRESSES[5];

    const pullRewardsIncentivesController = await deployPullRewardsIncentivesController([
      fakeToken,
      peiEmissionManager,
    ]);
    await expect(await pullRewardsIncentivesController.REWARD_TOKEN()).to.be.equal(fakeToken);
    await expect((await pullRewardsIncentivesController.EMISSION_MANAGER()).toString()).to.be.equal(
      peiEmissionManager
    );
  });

  it('Should return same index while multiple asset index updates', async () => {
    const { aDaiBaseMock, pullRewardsIncentivesController, users } = testEnv;
    await waitForTx(
      await pullRewardsIncentivesController.configureAssets([aDaiBaseMock.address], ['100'])
    );
    await waitForTx(await aDaiBaseMock.doubleHandleActionOnAic(users[1].address, '2000', '100'));
  });

  it('Should overflow index if passed a large emission', async () => {
    const { aDaiBaseMock, pullRewardsIncentivesController, users } = testEnv;
    const MAX_104_UINT = '20282409603651670423947251286015';

    await waitForTx(
      await pullRewardsIncentivesController.configureAssets([aDaiBaseMock.address], [MAX_104_UINT])
    );
    await expect(
      aDaiBaseMock.doubleHandleActionOnAic(users[1].address, '2000', '100')
    ).to.be.revertedWith('Index overflow');
  });

  it('Should configureAssets revert if parameters length does not match', async () => {
    const { aDaiBaseMock, pullRewardsIncentivesController } = testEnv;

    await expect(
      pullRewardsIncentivesController.configureAssets([aDaiBaseMock.address], ['1', '2'])
    ).to.be.revertedWith('INVALID_CONFIGURATION');
  });

  it('Should configureAssets revert if emission parameter overflows uin104', async () => {
    const { aDaiBaseMock, pullRewardsIncentivesController } = testEnv;

    await expect(
      pullRewardsIncentivesController.configureAssets([aDaiBaseMock.address], [MAX_UINT_AMOUNT])
    ).to.be.revertedWith('Index overflow at emissionsPerSecond');
  });

  it('Should REWARD_TOKEN getter returns the stake token address to keep old interface compatibility', async () => {
    const { pullRewardsIncentivesController, aaveToken } = testEnv;
    await expect(await pullRewardsIncentivesController.REWARD_TOKEN()).to.be.equal(
      aaveToken.address
    );
  });

  it('Should claimRewards revert if to argument is ZERO_ADDRESS', async () => {
    const { pullRewardsIncentivesController, users, aDaiBaseMock } = testEnv;
    const [userWithRewards] = users;

    await waitForTx(
      await pullRewardsIncentivesController.configureAssets([aDaiBaseMock.address], ['2000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '30000'));

    // Claim from third party claimer
    await expect(
      pullRewardsIncentivesController
        .connect(userWithRewards.signer)
        .claimRewards([aDaiBaseMock.address], MAX_UINT_AMOUNT, ZERO_ADDRESS)
    ).to.be.revertedWith('INVALID_TO_ADDRESS');
  });
});
