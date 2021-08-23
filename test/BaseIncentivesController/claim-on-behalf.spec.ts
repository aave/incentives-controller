import { expect } from 'chai';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../../helpers/constants';
import { waitForTx } from '../../helpers/misc-utils';

import { makeSuite, TestEnv } from '../helpers/make-suite';

makeSuite('baseIncentivesController - Claim rewards on behalf', (testEnv: TestEnv) => {
  it('Should setClaimer revert if not called by emission manager', async () => {
    const { baseIncentivesController, users } = testEnv;
    const [userWithRewards, thirdClaimer] = users;
    await expect(
      baseIncentivesController
        .connect(userWithRewards.signer)
        .setClaimer(userWithRewards.address, thirdClaimer.address)
    ).to.be.revertedWith('ONLY_EMISSION_MANAGER');
  });
  it('Should claimRewardsOnBehalf revert if called claimer is not authorized', async () => {
    const { baseIncentivesController, users, aDaiBaseMock, aaveToken } = testEnv;
    const [userWithRewards, thirdClaimer] = users;

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['20000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '300000'));

    // Claim from third party claimer
    const priorStkBalance = await aaveToken.balanceOf(thirdClaimer.address);

    await expect(
      baseIncentivesController
        .connect(thirdClaimer.signer)
        .claimRewardsOnBehalf(
          [aDaiBaseMock.address],
          MAX_UINT_AMOUNT,
          userWithRewards.address,
          thirdClaimer.address
        )
    ).to.be.revertedWith('CLAIMER_UNAUTHORIZED');

    const afterStkBalance = await aaveToken.balanceOf(thirdClaimer.address);
    expect(afterStkBalance).to.be.eq(priorStkBalance);
  });
  it('Should setClaimer pass if called by emission manager', async () => {
    const { baseIncentivesController, users, rewardsVault } = testEnv;
    const [userWithRewards, thirdClaimer] = users;
    const emissionManager = rewardsVault;

    await expect(
      baseIncentivesController
        .connect(emissionManager.signer)
        .setClaimer(userWithRewards.address, thirdClaimer.address)
    )
      .to.emit(baseIncentivesController, 'ClaimerSet')
      .withArgs(userWithRewards.address, thirdClaimer.address);
    await expect(await baseIncentivesController.getClaimer(userWithRewards.address)).to.be.equal(
      thirdClaimer.address
    );
  });
  it('Should claimRewardsOnBehalf pass if called by the assigned claimer', async () => {
    const { baseIncentivesController, users, aDaiBaseMock, aaveToken } = testEnv;
    const [userWithRewards, thirdClaimer] = users;

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['2000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '30000'));

    // Claim from third party claimer
    const priorBalance = await aaveToken.balanceOf(thirdClaimer.address);

    await expect(
      baseIncentivesController
        .connect(thirdClaimer.signer)
        .claimRewardsOnBehalf(
          [aDaiBaseMock.address],
          MAX_UINT_AMOUNT,
          userWithRewards.address,
          thirdClaimer.address
        )
    )
      .to.emit(baseIncentivesController, 'RewardsClaimed')
      .withArgs(userWithRewards.address, thirdClaimer.address, thirdClaimer.address, '99999');
    const afterStkBalance = await aaveToken.balanceOf(thirdClaimer.address);
    console.log('adt', afterStkBalance.toString());
    expect(afterStkBalance).to.be.gt(priorBalance);
  });

  it('Should claimRewardsOnBehalf revert if to argument address is ZERO_ADDRESS', async () => {
    const { baseIncentivesController, users, aDaiBaseMock, aaveToken } = testEnv;
    const [userWithRewards, thirdClaimer] = users;

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['2000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '30000'));

    await expect(
      baseIncentivesController
        .connect(thirdClaimer.signer)
        .claimRewardsOnBehalf(
          [aDaiBaseMock.address],
          MAX_UINT_AMOUNT,
          userWithRewards.address,
          ZERO_ADDRESS
        )
    ).to.be.revertedWith('INVALID_TO_ADDRESS');
  });

  it('Should claimRewardsOnBehalf revert if user argument is ZERO_ADDRESS', async () => {
    const { baseIncentivesController, users, aDaiBaseMock, rewardsVault } = testEnv;
    const [, thirdClaimer] = users;

    const emissionManager = rewardsVault;

    await waitForTx(
      await baseIncentivesController.configureAssets([aDaiBaseMock.address], ['2000'])
    );
    await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply('300000', '30000'));

    await expect(
      baseIncentivesController
        .connect(emissionManager.signer)
        .setClaimer(ZERO_ADDRESS, thirdClaimer.address)
    )
      .to.emit(baseIncentivesController, 'ClaimerSet')
      .withArgs(ZERO_ADDRESS, thirdClaimer.address);

    await expect(
      baseIncentivesController
        .connect(thirdClaimer.signer)
        .claimRewardsOnBehalf(
          [aDaiBaseMock.address],
          MAX_UINT_AMOUNT,
          ZERO_ADDRESS,
          thirdClaimer.address
        )
    ).to.be.revertedWith('INVALID_USER_ADDRESS');
  });
});
