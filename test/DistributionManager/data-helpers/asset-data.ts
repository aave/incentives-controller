import { BigNumber, BigNumberish } from 'ethers';
import { comparatorEngine, CompareRules } from '../../helpers/comparator-engine';
import { getNormalizedDistribution } from '../../helpers/ray-math';
import { AaveDistributionManager } from '../../../types/AaveDistributionManager';
import { StakedTokenIncentivesController } from '../../../types';

export type AssetUpdateData = {
  emissionPerSecond: BigNumberish;
  totalStaked: BigNumberish;
  underlyingAsset: string;
};
export type AssetData = {
  emissionPerSecond: BigNumber;
  index: BigNumber;
  lastUpdateTimestamp: BigNumber;
};

export async function getAssetsData(
  peiContract: AaveDistributionManager | StakedTokenIncentivesController,
  assets: string[]
) {
  return await Promise.all(
    assets.map(async (underlyingAsset) => {
      const response = await peiContract.getAssetData(underlyingAsset);
      return {
        emissionPerSecond: response[1],
        lastUpdateTimestamp: response[2],
        index: response[0],
        underlyingAsset,
      };
    })
  );
}

export function assetDataComparator<
  Input extends { underlyingAsset: string; totalStaked: BigNumberish },
  State extends AssetData
>(
  assetConfigUpdateInput: Input,
  assetConfigBefore: State,
  assetConfigAfter: State,
  actionBlockTimestamp: number,
  emissionEndTimestamp: number,
  compareRules: CompareRules<Input, State>
) {
  return comparatorEngine(
    ['emissionPerSecond', 'index', 'lastUpdateTimestamp'],
    assetConfigUpdateInput,
    assetConfigBefore,
    assetConfigAfter,
    actionBlockTimestamp,
    {
      ...compareRules,
      fieldsWithCustomLogic: [
        // should happen on any update
        {
          fieldName: 'lastUpdateTimestamp',
          logic: (stateUpdate, stateBefore, stateAfter, txTimestamp) => txTimestamp.toString(),
        },
        {
          fieldName: 'index',
          logic: async (stateUpdate, stateBefore, stateAfter, txTimestamp) => {
            return getNormalizedDistribution(
              stateUpdate.totalStaked.toString(),
              stateBefore.index,
              stateBefore.emissionPerSecond,
              stateBefore.lastUpdateTimestamp,
              txTimestamp,
              emissionEndTimestamp
            ).toString(10);
          },
        },
        ...(compareRules.fieldsWithCustomLogic || []),
      ],
    }
  );
}
