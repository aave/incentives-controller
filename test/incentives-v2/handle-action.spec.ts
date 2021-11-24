import { fail } from 'assert';
const { expect } = require('chai');

import { waitForTx, increaseTime } from '../../helpers/misc-utils';
import { makeSuite } from '../helpers/make-suite';
import { eventChecker, eventLogChecker } from '../helpers/comparator-engine';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';
import { getUserIndex } from '../DistributionManagerV2/data-helpers/asset-user-data';
import { getRewardsData } from '../DistributionManagerV2/data-helpers/asset-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { assetDataComparator } from '../DistributionManager/data-helpers/asset-data';

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

makeSuite('AaveIncentivesController handleAction tests', (testEnv) => {
  for (const {
    caseName,
    totalSupply,
    userBalance,
    customTimeMovement,
    emissionPerSecond,
  } of handleActionScenarios) {
    it(caseName, async () => {
      await increaseTime(100);

      const {
        incentivesControllerV2,
        users,
        aDaiMockV2,
        stakedAave: { address: reward },
        stakedTokenStrategy,
        distributionEnd,
      } = testEnv;
      const userAddress = users[1].address;
      const underlyingAsset = aDaiMockV2.address;

      // update emissionPerSecond in advance to not affect user calculations
      if (emissionPerSecond) {
        await waitForTx(
          await incentivesControllerV2.configureAssets([
            {
              asset: underlyingAsset,
              reward,
              emissionPerSecond: emissionPerSecond,
              distributionEnd,
              totalStaked: '0',
              transferStrategy: stakedTokenStrategy.address,
              transferStrategyParams: '0x',
            },
          ])
        );
      }

      const rewardsBalanceBefore = await incentivesControllerV2.getUserUnclaimedRewardsFromStorage(
        userAddress,
        reward
      );
      const userIndexBefore = await getUserIndex(
        incentivesControllerV2,
        userAddress,
        underlyingAsset,
        reward
      );
      const assetDataBefore = (
        await getRewardsData(incentivesControllerV2, [underlyingAsset], [reward])
      )[0];

      if (customTimeMovement) {
        await increaseTime(customTimeMovement);
      }

      await waitForTx(await aDaiMockV2.setUserBalanceAndSupply(userBalance, totalSupply));
      const handleActionReceipt = await waitForTx(
        await aDaiMockV2.handleActionOnAic(userAddress, totalSupply, userBalance)
      );
      const eventsEmitted =
        handleActionReceipt.events?.map((e) => incentivesControllerV2.interface.parseLog(e)) || [];
      const actionBlockTimestamp = await getBlockTimestamp(handleActionReceipt.blockNumber);

      const userIndexAfter = await getUserIndex(
        incentivesControllerV2,
        userAddress,
        underlyingAsset,
        reward
      );

      const assetDataAfter = (
        await getRewardsData(incentivesControllerV2, [underlyingAsset], [reward])
      )[0];

      const expectedAccruedRewards = getRewards(
        userBalance,
        userIndexAfter,
        userIndexBefore
      ).toString();

      const rewardsBalanceAfter = await incentivesControllerV2.getUserRewardsBalance(
        [underlyingAsset],
        userAddress,
        reward
      );

      // ------- Distribution Manager tests START -----
      await assetDataComparator(
        { underlyingAsset, totalStaked: totalSupply },
        assetDataBefore,
        assetDataAfter,
        actionBlockTimestamp,
        distributionEnd,
        {}
      );
      expect(userIndexAfter.toString()).to.be.equal(
        assetDataAfter.index.toString(),
        'user index are not correctly updated'
      );

      if (!assetDataAfter.index.eq(assetDataBefore.index)) {
        const eventAssetUpdated = eventsEmitted.find(({ name }) => name === 'AssetIndexUpdated');
        const eventUserIndexUpdated = eventsEmitted.find(({ name }) => name === 'UserIndexUpdated');

        if (!eventAssetUpdated) {
          fail('missing AssetIndexUpdated event');
        }
        if (!eventUserIndexUpdated) {
          fail('missing UserIndexUpdated event');
        }
        eventLogChecker(eventAssetUpdated, 'AssetIndexUpdated', [
          assetDataAfter.underlyingAsset,
          reward,
          assetDataAfter.index,
        ]);
        eventLogChecker(eventUserIndexUpdated, 'UserIndexUpdated', [
          userAddress,
          assetDataAfter.underlyingAsset,
          reward,
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
        const eventAssetUpdated = eventsEmitted.find(({ name }) => name === 'RewardsAccrued');
        if (!eventAssetUpdated) {
          fail('missing RewardsAccrued event');
        }
        eventLogChecker(eventAssetUpdated, 'RewardsAccrued', [
          userAddress,
          reward,
          expectedAccruedRewards,
        ]);
      }
      // ------- PEI tests END -----
    });
  }
});
