import { MAX_UINT_AMOUNT, RANDOM_ADDRESSES } from '../../helpers/constants';

const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { BigNumber } from 'ethers';
import { waitForTx, increaseTime } from '../../helpers/misc-utils';
import { comparatorEngine, eventChecker } from '../helpers/comparator-engine';
import { getUserIndex } from '../DistributionManager/data-helpers/asset-user-data';
import { assetDataComparator, getAssetsData } from '../DistributionManager/data-helpers/asset-data';
import { getBlockTimestamp } from '../../helpers/contracts-helpers';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { fail } from 'assert';

type ScenarioAction = {
  caseName: string;
  emissionPerSecond?: string;
  amountToClaim: string;
  to?: string;
  toStake?: boolean;
};

const getRewardsBalanceScenarios: ScenarioAction[] = [
  {
    caseName: 'Accrued rewards are 0, claim 0',
    emissionPerSecond: '0',
    amountToClaim: '0',
  },
  {
    caseName: 'Accrued rewards are 0, claim not 0',
    emissionPerSecond: '0',
    amountToClaim: '100',
  },
  {
    caseName: 'Accrued rewards are not 0',
    emissionPerSecond: '2432424',
    amountToClaim: MAX_UINT_AMOUNT,
  },
  {
    caseName: 'Should allow -1',
    emissionPerSecond: '2432424',
    amountToClaim: MAX_UINT_AMOUNT,
  },
  {
    caseName: 'Should withdraw everything if amountToClaim more then rewards balance',
    emissionPerSecond: '100',
    amountToClaim: '1034',
  },
  {
    caseName: 'Should withdraw to another user',
    emissionPerSecond: '100',
    amountToClaim: '1034',
    to: RANDOM_ADDRESSES[5],
  },
  {
    caseName: 'Should withdraw to another user and stake',
    emissionPerSecond: '100',
    amountToClaim: '1034',
    to: RANDOM_ADDRESSES[5],
  },
];

makeSuite('pullRewardsIncentivesController claimRewards tests', (testEnv) => {
  for (const {
    caseName,
    amountToClaim: _amountToClaim,
    to,
    emissionPerSecond,
  } of getRewardsBalanceScenarios) {
    let amountToClaim = _amountToClaim;
    it(caseName, async () => {
      await increaseTime(100);
      const { pullRewardsIncentivesController, aaveToken, aDaiBaseMock } = testEnv;

      const distributionEndTimestamp = await pullRewardsIncentivesController.getDistributionEnd();
      const userAddress = await pullRewardsIncentivesController.signer.getAddress();

      const underlyingAsset = aDaiBaseMock.address;
      const stakedByUser = 22 * caseName.length;
      const totalStaked = 33 * caseName.length;

      // update emissionPerSecond in advance to not affect user calculations
      if (emissionPerSecond) {
        await pullRewardsIncentivesController.configureAssets(
          [underlyingAsset],
          [emissionPerSecond]
        );
      }

      const destinationAddress = to || userAddress;

      const destinationAddressBalanceBefore = await aaveToken.balanceOf(destinationAddress);
      await aDaiBaseMock.setUserBalanceAndSupply(stakedByUser, totalStaked);
      await aDaiBaseMock.handleActionOnAic(userAddress, totalStaked, stakedByUser);

      const unclaimedRewardsBefore = await pullRewardsIncentivesController.getRewardsBalance(
        [underlyingAsset],
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

      const claimRewardsReceipt = await waitForTx(
        await pullRewardsIncentivesController.claimRewards(
          [underlyingAsset],
          amountToClaim,
          destinationAddress
        )
      );
      const eventsEmitted = claimRewardsReceipt.events || [];

      const actionBlockTimestamp = await getBlockTimestamp(claimRewardsReceipt.blockNumber);

      const userIndexAfter = await getUserIndex(
        pullRewardsIncentivesController,
        userAddress,
        underlyingAsset
      );
      const assetDataAfter = (
        await getAssetsData(pullRewardsIncentivesController, [underlyingAsset])
      )[0];

      const unclaimedRewardsAfter = await pullRewardsIncentivesController.getRewardsBalance(
        [underlyingAsset],
        userAddress
      );

      const destinationAddressBalanceAfter = await aaveToken.balanceOf(destinationAddress);

      const claimedAmount = destinationAddressBalanceAfter.sub(destinationAddressBalanceBefore);

      const expectedAccruedRewards = getRewards(
        stakedByUser,
        userIndexAfter,
        userIndexBefore
      ).toString();

      await aDaiBaseMock.cleanUserState();

      if (amountToClaim === '0') {
        // state should not change
        expect(userIndexBefore.toString()).to.be.equal(
          userIndexAfter.toString(),
          'userIndexAfter should not change'
        );
        expect(unclaimedRewardsBefore.toString()).to.be.equal(
          unclaimedRewardsAfter.toString(),
          'unclaimedRewards should not change'
        );
        expect(destinationAddressBalanceBefore.toString()).to.be.equal(
          destinationAddressBalanceAfter.toString(),
          'destinationAddressBalance should not change'
        );
        await comparatorEngine(
          ['emissionPerSecond', 'index', 'lastUpdateTimestamp'],
          { underlyingAsset, totalStaked },
          assetDataBefore,
          assetDataAfter,
          actionBlockTimestamp,
          {}
        );
        expect(eventsEmitted.length).to.be.equal(0, 'no events should be emitted');
        return;
      }

      // ------- Distribution Manager tests START -----
      await assetDataComparator(
        { underlyingAsset, totalStaked },
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
        eventChecker(eventsEmitted[0], 'AssetIndexUpdated', [
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
        eventChecker(eventsEmitted[1], 'UserIndexUpdated', [
          userAddress,
          assetDataAfter.underlyingAsset,
          assetDataAfter.index,
        ]);
      }
      // ------- Distribution Manager tests END -----

      let unclaimedRewardsCalc = unclaimedRewardsBefore.add(expectedAccruedRewards);

      let expectedClaimedAmount: BigNumber;
      if (unclaimedRewardsCalc.lte(amountToClaim)) {
        expectedClaimedAmount = unclaimedRewardsCalc;
        expect(unclaimedRewardsAfter.toString()).to.be.equal(
          '0',
          'unclaimed amount after should go to 0'
        );
      } else {
        expectedClaimedAmount = BigNumber.from(amountToClaim);
        expect(unclaimedRewardsAfter.toString()).to.be.equal(
          unclaimedRewardsCalc.sub(amountToClaim).toString(),
          'unclaimed rewards after are wrong'
        );
      }

      expect(claimedAmount.toString()).to.be.equal(
        expectedClaimedAmount.toString(),
        'claimed amount are wrong'
      );
      if (expectedAccruedRewards !== '0') {
        const rewardsAccruedEvent = eventsEmitted.find(({ event }) => event === 'RewardsAccrued');
        // Expect event to exist
        expect(rewardsAccruedEvent).to.be.ok;
        if (rewardsAccruedEvent) {
          eventChecker(rewardsAccruedEvent, 'RewardsAccrued', [
            userAddress,
            expectedAccruedRewards,
          ]);
        } else {
          fail('missing accrued event');
        }
      }
      if (expectedClaimedAmount.gt(0)) {
        const rewardsClaimedEvent = eventsEmitted.find(({ event }) => event === 'RewardsClaimed');
        // Expect event to exist
        expect(rewardsClaimedEvent).to.be.ok;
        if (rewardsClaimedEvent) {
          eventChecker(rewardsClaimedEvent, 'RewardsClaimed', [
            userAddress,
            destinationAddress,
            userAddress,
            expectedClaimedAmount,
          ]);
        } else {
          fail('missing reward event');
        }
      }
    });
  }
});
