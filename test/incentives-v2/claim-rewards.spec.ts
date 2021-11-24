import { getBlockTimestamp } from './../../helpers/contracts-helpers';
import { MAX_UINT_AMOUNT, RANDOM_ADDRESSES } from '../../helpers/constants';

const { expect } = require('chai');

import { makeSuite } from '../helpers/make-suite';
import { BigNumber } from 'ethers';
import { waitForTx, increaseTime } from '../../helpers/misc-utils';
import { comparatorEngine, eventChecker } from '../helpers/comparator-engine';
import { assetDataComparator } from '../DistributionManager/data-helpers/asset-data';
import { getRewards } from '../DistributionManager/data-helpers/base-math';
import { fail } from 'assert';
import { getRewardsData } from '../DistributionManagerV2/data-helpers/asset-data';
import { getUserIndex } from '../DistributionManagerV2/data-helpers/asset-user-data';

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
    amountToClaim: '10',
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

makeSuite('Incentives Controller V2 claimRewards tests', (testEnv) => {
  for (const {
    caseName,
    amountToClaim: _amountToClaim,
    to,
    emissionPerSecond,
  } of getRewardsBalanceScenarios) {
    let amountToClaim = _amountToClaim;
    it(caseName, async () => {
      await increaseTime(100);
      const {
        incentivesControllerV2,
        stakedAave,
        aDaiMockV2,
        stakedTokenStrategy,
        distributionEnd,
      } = testEnv;

      const userAddress = await incentivesControllerV2.signer.getAddress();

      const underlyingAsset = aDaiMockV2.address;
      const stakedByUser = 22 * caseName.length;
      const totalStaked = 33 * caseName.length;
      const reward = stakedAave.address;

      await aDaiMockV2.setUserBalanceAndSupply(stakedByUser, totalStaked);

      // update emissionPerSecond in advance to not affect user calculations
      if (emissionPerSecond) {
        await waitForTx(
          await incentivesControllerV2.configureAssets([
            {
              asset: underlyingAsset,
              reward,
              emissionPerSecond,
              distributionEnd,
              totalStaked,
              transferStrategy: stakedTokenStrategy.address,
              transferStrategyParams: '0x',
            },
          ])
        );
      }

      const destinationAddress = to || userAddress;

      const destinationAddressBalanceBefore = await stakedAave.balanceOf(destinationAddress);
      await aDaiMockV2.handleActionOnAic(userAddress, totalStaked, stakedByUser);

      const unclaimedRewardsBefore = await incentivesControllerV2.getUserRewardsBalance(
        [underlyingAsset],
        userAddress,
        reward
      );
      const unclaimedRewardsStorageBefore = await incentivesControllerV2.getUserUnclaimedRewardsFromStorage(
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

      const action = await incentivesControllerV2.claimRewards(
        [underlyingAsset],
        amountToClaim,
        destinationAddress,
        reward
      );
      const claimRewardsReceipt = await waitForTx(action);
      const eventsEmitted = claimRewardsReceipt.events || [];

      const actionBlockTimestamp = await getBlockTimestamp(claimRewardsReceipt.blockNumber);

      const userIndexAfter = await getUserIndex(
        incentivesControllerV2,
        userAddress,
        underlyingAsset,
        reward
      );
      const assetDataAfter = (
        await getRewardsData(incentivesControllerV2, [underlyingAsset], [reward])
      )[0];

      const unclaimedRewardsAfter = await incentivesControllerV2.getUserRewardsBalance(
        [underlyingAsset],
        userAddress,
        reward
      );
      const unclaimedRewardsStorageAfter = await incentivesControllerV2.getUserUnclaimedRewardsFromStorage(
        userAddress,
        reward
      );

      const destinationAddressBalanceAfter = await stakedAave.balanceOf(destinationAddress);

      const claimedAmount = destinationAddressBalanceAfter.sub(destinationAddressBalanceBefore);

      // Only calculate expected accrued rewards if unclaimedRewards is below the amount to claim due gas optimization
      const expectedAccruedRewards = unclaimedRewardsStorageBefore.lt(amountToClaim)
        ? getRewards(stakedByUser, userIndexAfter, userIndexBefore).toString()
        : '0';

      await aDaiMockV2.cleanUserState();

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
        unclaimedRewardsStorageBefore.gte(amountToClaim)
          ? Number(assetDataBefore.lastUpdateTimestamp.toString())
          : actionBlockTimestamp,
        distributionEnd,
        {}
      );
      expect(userIndexAfter.toString()).to.be.equal(
        unclaimedRewardsStorageBefore.gte(amountToClaim)
          ? userIndexBefore.toString()
          : assetDataAfter.index.toString(),
        'user index are not correctly updated'
      );
      if (!assetDataAfter.index.eq(assetDataBefore.index)) {
        await expect(action)
          .to.emit(incentivesControllerV2, 'AssetIndexUpdated')
          .withArgs(assetDataAfter.underlyingAsset, reward, assetDataAfter.index);
        await expect(action)
          .to.emit(incentivesControllerV2, 'UserIndexUpdated')
          .withArgs(userAddress, assetDataAfter.underlyingAsset, reward, assetDataAfter.index);
      }
      // ------- Distribution Manager tests END -----

      let unclaimedRewardsCalc = unclaimedRewardsStorageBefore.add(expectedAccruedRewards);

      let expectedClaimedAmount: BigNumber;
      if (unclaimedRewardsCalc.lte(amountToClaim)) {
        expectedClaimedAmount = unclaimedRewardsCalc;
        expect(unclaimedRewardsStorageAfter.toString()).to.be.equal(
          '0',
          'unclaimed amount after should go to 0'
        );
      } else {
        expectedClaimedAmount = BigNumber.from(amountToClaim);
        expect(unclaimedRewardsStorageAfter.toString()).to.be.equal(
          unclaimedRewardsCalc.sub(amountToClaim).toString(),
          'unclaimed rewards after are wrong'
        );
      }

      expect(claimedAmount.toString()).to.be.equal(
        expectedClaimedAmount.toString(),
        'claimed amount are wrong'
      );
      if (expectedAccruedRewards !== '0') {
        await expect(action)
          .to.emit(incentivesControllerV2, 'RewardsAccrued')
          .withArgs(userAddress, reward, expectedAccruedRewards);
        await expect(action)
          .to.emit(incentivesControllerV2, 'UserIndexUpdated')
          .withArgs(userAddress, assetDataAfter.underlyingAsset, reward, assetDataAfter.index);
      }
      if (expectedClaimedAmount.gt(0)) {
        await expect(action)
          .to.emit(incentivesControllerV2, 'RewardsClaimed')
          .withArgs(userAddress, reward, destinationAddress, userAddress, expectedClaimedAmount);
      }
    });
  }
});
