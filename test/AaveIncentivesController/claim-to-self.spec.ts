import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { makeSuite, TestEnv } from '../helpers/make-suite';
import { waitForTx } from '../../helpers/misc-utils';

makeSuite('AaveIncentivesController - Claim rewards to self', (testEnv: TestEnv) => {
  it('Should withdraw to the claimer', async () => {
    const { aaveIncentivesController, users, aDaiMock, stakedAave } = testEnv;
    const [userWithRewards] = users;

    await waitForTx(await aaveIncentivesController.configureAssets([aDaiMock.address], ['2000']));
    await waitForTx(await aDaiMock.setUserBalanceAndSupply('300000', '30000'));

    const priorStkBalance = await stakedAave.balanceOf(userWithRewards.address);

    const amountToClaim = BigNumber.from(123);

    await expect(
      aaveIncentivesController
        .connect(userWithRewards.signer)
        .claimRewardsToSelf(
          [aDaiMock.address],
          amountToClaim
        )
    )
      .to.emit(aaveIncentivesController, 'RewardsClaimed')
      .withArgs(userWithRewards.address, userWithRewards.address, userWithRewards.address, amountToClaim);

    const afterStkBalance = await stakedAave.balanceOf(userWithRewards.address);
    expect(afterStkBalance).to.be.eq(priorStkBalance.add(amountToClaim));
  });
});
