const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import { advanceBlock, timeLatest, waitForTx, increaseTime } from '../../helpers/misc-utils';
import { getNormalizedDistribution } from '../helpers/ray-math';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';

type ScenarioAction = {
  caseName: string;
  emissionPerSecond: string;
};

const getRewardsBalanceScenarios: ScenarioAction[] = [
  {
    caseName: 'Accrued rewards are 0',
    emissionPerSecond: '0',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
  },
];

makeSuite('baseIncentivesController getRewardsBalance tests', (testEnv) => {
  for (const { caseName, emissionPerSecond } of getRewardsBalanceScenarios) {
    it(caseName, async () => {
      await increaseTime(100);

      const { baseIncentivesController, users, aDaiBaseMock } = testEnv;

      const distributionEndTimestamp = await baseIncentivesController.DISTRIBUTION_END();
      const userAddress = users[1].address;
      const stakedByUser = 22 * caseName.length;
      const totalStaked = 33 * caseName.length;
      const underlyingAsset = aDaiBaseMock.address;

      // update emissionPerSecond in advance to not affect user calculations
      await advanceBlock((await timeLatest()).plus(100).toNumber());
      if (emissionPerSecond) {
        await aDaiBaseMock.setUserBalanceAndSupply('0', totalStaked);
        await baseIncentivesController.configureAssets([underlyingAsset], [emissionPerSecond]);
      }
      await aDaiBaseMock.handleActionOnAic(userAddress, totalStaked, stakedByUser);
      await advanceBlock((await timeLatest()).plus(100).toNumber());

      const lastTxReceipt = await waitForTx(
        await aDaiBaseMock.setUserBalanceAndSupply(stakedByUser, totalStaked)
      );
      const lastTxTimestamp = await getBlockTimestamp(lastTxReceipt.blockNumber);

      const unclaimedRewardsBefore = await baseIncentivesController.getUserUnclaimedRewards(
        userAddress
      );

      const unclaimedRewards = await baseIncentivesController.getRewardsBalance(
        [underlyingAsset],
        userAddress
      );

      const userIndex = await getUserIndex(baseIncentivesController, userAddress, underlyingAsset);
      const assetData = (await getAssetsData(baseIncentivesController, [underlyingAsset]))[0];

      await aDaiBaseMock.cleanUserState();

      const expectedAssetIndex = getNormalizedDistribution(
        totalStaked,
        assetData.index,
        assetData.emissionPerSecond,
        assetData.lastUpdateTimestamp,
        lastTxTimestamp,
        distributionEndTimestamp
      );
      const expectedAccruedRewards = getRewards(
        stakedByUser,
        expectedAssetIndex,
        userIndex
      ).toString();

      expect(unclaimedRewards.toString()).to.be.equal(
        unclaimedRewardsBefore.add(expectedAccruedRewards).toString()
      );
    });
  }
});
