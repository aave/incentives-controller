import { fail } from 'assert';
const { expect } = require('chai');

import { waitForTx, increaseTime } from '../../helpers/misc-utils';
import { makeSuite } from '../helpers/make-suite';
import { eventChecker } from '../helpers/comparator-engine';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';

import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { assetDataComparator, getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';

type ScenarioAction = {
  caseName: string;
  emissionPerSecond?: string;
  userBalance: string;
  totalSupply: string;
  customTimeMovement?: number;
};

const handleActionScenarios: ScenarioAction[] = [
  {
    caseName: 'All 0',
    emissionPerSecond: '0',
    userBalance: '0',
    totalSupply: '0',
  },
  {
    caseName: 'Accrued rewards are 0, 0 emission',
    emissionPerSecond: '0',
    userBalance: '22',
    totalSupply: '22',
  },
  {
    caseName: 'Accrued rewards are 0, 0 user balance',
    emissionPerSecond: '100',
    userBalance: '0',
    totalSupply: '22',
  },
  {
    caseName: '1. Accrued rewards are not 0',
    userBalance: '22',
    totalSupply: '22',
  },
  {
    caseName: '2. Accrued rewards are not 0',
    emissionPerSecond: '1000',
    userBalance: '2332',
    totalSupply: '3232',
  },
];

makeSuite('pullRewardsIncentivesController handleAction tests', (testEnv) => {
  for (const {
    caseName,
    totalSupply,
    userBalance,
    customTimeMovement,
    emissionPerSecond,
  } of handleActionScenarios) {
    it(caseName, async () => {
      await increaseTime(100);

      const { pullRewardsIncentivesController, users, aDaiBaseMock } = testEnv;
      const userAddress = users[1].address;
      const underlyingAsset = aDaiBaseMock.address;

      // update emissionPerSecond in advance to not affect user calculations
      if (emissionPerSecond) {
        await pullRewardsIncentivesController.configureAssets(
          [underlyingAsset],
          [emissionPerSecond]
        );
      }

      const distributionEndTimestamp = await pullRewardsIncentivesController.DISTRIBUTION_END();

      const rewardsBalanceBefore = await pullRewardsIncentivesController.getUserUnclaimedRewards(
        userAddress
      );
      const userIndexBefore = await getUserIndex(
        pullRewardsIncentivesController,
        userAddress,
        underlyingAsset
      );
      const assetDataBefore = (
        await getAssetsData(pullRewardsIncentivesController, [underlyingAsset])
      )[0];

      if (customTimeMovement) {
        await increaseTime(customTimeMovement);
      }

      await waitForTx(await aDaiBaseMock.setUserBalanceAndSupply(userBalance, totalSupply));
      const handleActionReceipt = await waitForTx(
        await aDaiBaseMock.handleActionOnAic(userAddress, totalSupply, userBalance)
      );
      const eventsEmitted = handleActionReceipt.events || [];
      const actionBlockTimestamp = await getBlockTimestamp(handleActionReceipt.blockNumber);

      const userIndexAfter = await getUserIndex(
        pullRewardsIncentivesController,
        userAddress,
        underlyingAsset
      );

      const assetDataAfter = (
        await getAssetsData(pullRewardsIncentivesController, [underlyingAsset])
      )[0];

      const expectedAccruedRewards = getRewards(
        userBalance,
        userIndexAfter,
        userIndexBefore
      ).toString();

      const rewardsBalanceAfter = await pullRewardsIncentivesController.getUserUnclaimedRewards(
        userAddress
      );

      // ------- Distribution Manager tests START -----
      await assetDataComparator(
        { underlyingAsset, totalStaked: totalSupply },
        assetDataBefore,
        assetDataAfter,
        actionBlockTimestamp,
        distributionEndTimestamp.toNumber(),
        {}
      );
      expect(userIndexAfter.toString()).to.be.equal(
        assetDataAfter.index.toString(),
        'user index are not correctly updated'
      );
      if (!assetDataAfter.index.eq(assetDataBefore.index)) {
        const eventAssetUpdated = eventsEmitted.find(({ event }) => event === 'AssetIndexUpdated');
        const eventUserIndexUpdated = eventsEmitted.find(
          ({ event }) => event === 'UserIndexUpdated'
        );

        if (!eventAssetUpdated) {
          fail('missing AssetIndexUpdated event');
        }
        if (!eventUserIndexUpdated) {
          fail('missing UserIndexUpdated event');
        }
        eventChecker(eventAssetUpdated, 'AssetIndexUpdated', [
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
        eventChecker(eventUserIndexUpdated, 'UserIndexUpdated', [
          userAddress,
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
      }
      // ------- Distribution Manager tests END -----

      // ------- PEI tests START -----
      expect(rewardsBalanceAfter.toString()).to.be.equal(
        rewardsBalanceBefore.add(expectedAccruedRewards).toString(),
        'rewards balance are incorrect'
      );
      if (expectedAccruedRewards !== '0') {
        const eventAssetUpdated = eventsEmitted.find(({ event }) => event === 'RewardsAccrued');
        if (!eventAssetUpdated) {
          fail('missing RewardsAccrued event');
        }
        eventChecker(eventAssetUpdated, 'RewardsAccrued', [userAddress, expectedAccruedRewards]);
      }
      // ------- PEI tests END -----
    });
  }
});
