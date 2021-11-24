import { StakedTokenTransferStrategy } from './../../types/StakedTokenTransferStrategy.d';
import { PullRewardsTransferStrategy } from './../../types/PullRewardsTransferStrategy.d';
import { evmRevert, evmSnapshot, DRE } from '../../helpers/misc-utils';
import { Signer } from 'ethers';
import { getBlockTimestamp, getEthersSigners } from '../../helpers/contracts-helpers';
import { tEthereumAddress } from '../../helpers/types';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { getATokenMock } from '../../helpers/contracts-accessors';
import { MintableErc20 } from '../../types/MintableErc20';
import { ATokenMock } from '../../types/ATokenMock';
import { IncentivesControllerV2, StakedAaveV3, StakedTokenIncentivesController } from '../../types';

chai.use(bignumberChai());

export let stakedAaveInitializeTimestamp = 0;
export const setStakedAaveInitializeTimestamp = (timestamp: number) => {
  stakedAaveInitializeTimestamp = timestamp;
};

export interface SignerWithAddress {
  signer: Signer;
  address: tEthereumAddress;
}
export interface TestEnv {
  rewardsVault: SignerWithAddress;
  deployer: SignerWithAddress;
  users: SignerWithAddress[];
  aaveToken: MintableErc20;
  rewardToken: MintableErc20;
  aaveIncentivesController: StakedTokenIncentivesController;
  stakedAave: StakedAaveV3;
  aDaiMock: ATokenMock;
  aWethMock: ATokenMock;
  aDaiMockV2: ATokenMock;
  aWethMockV2: ATokenMock;
  incentivesControllerV2: IncentivesControllerV2;
  pullRewardsStrategy: PullRewardsTransferStrategy;
  stakedTokenStrategy: StakedTokenTransferStrategy;
  distributionEnd: number;
}

let buidlerevmSnapshotId: string = '0x1';
const setBuidlerevmSnapshotId = (id: string) => {
  if (DRE.network.name === 'hardhat') {
    buidlerevmSnapshotId = id;
  }
};

const testEnv: TestEnv = {
  deployer: {} as SignerWithAddress,
  users: [] as SignerWithAddress[],
  aaveToken: {} as MintableErc20,
  rewardToken: {} as MintableErc20,
  stakedAave: {} as StakedAaveV3,
  aaveIncentivesController: {} as StakedTokenIncentivesController,
  aDaiMock: {} as ATokenMock,
  aWethMock: {} as ATokenMock,
  aDaiMockV2: {} as ATokenMock,
  aWethMockV2: {} as ATokenMock,
  incentivesControllerV2: {} as IncentivesControllerV2,
  pullRewardsStrategy: {} as PullRewardsTransferStrategy,
  stakedTokenStrategy: {} as StakedTokenTransferStrategy,
  distributionEnd: 0,
} as TestEnv;

export async function initializeMakeSuite(
  aaveToken: MintableErc20,
  stakedAave: StakedAaveV3,
  aaveIncentivesController: StakedTokenIncentivesController,
  incentivesControllerV2: IncentivesControllerV2,
  pullRewardsStrategy: PullRewardsTransferStrategy,
  stakedTokenStrategy: StakedTokenTransferStrategy,
  rewardToken: MintableErc20
) {
  const [_deployer, _proxyAdmin, ...restSigners] = await getEthersSigners();
  const deployer: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  const rewardsVault: SignerWithAddress = {
    address: await _deployer.getAddress(),
    signer: _deployer,
  };

  for (const signer of restSigners) {
    testEnv.users.push({
      signer,
      address: await signer.getAddress(),
    });
  }
  testEnv.deployer = deployer;
  testEnv.rewardsVault = rewardsVault;
  testEnv.stakedAave = stakedAave;
  testEnv.aaveIncentivesController = aaveIncentivesController;
  testEnv.aaveToken = aaveToken;
  testEnv.aDaiMock = await getATokenMock({ slug: 'aDai' });
  testEnv.aWethMock = await getATokenMock({ slug: 'aWeth' });
  testEnv.aDaiMockV2 = await getATokenMock({ slug: 'aDaiV2' });
  testEnv.aWethMockV2 = await getATokenMock({ slug: 'aWethV2' });
  testEnv.incentivesControllerV2 = incentivesControllerV2;
  testEnv.pullRewardsStrategy = pullRewardsStrategy;
  testEnv.stakedTokenStrategy = stakedTokenStrategy;
  testEnv.rewardToken = rewardToken;
  testEnv.distributionEnd = (await getBlockTimestamp()) + 1000 * 60 * 60;
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      setBuidlerevmSnapshotId(await evmSnapshot());
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(buidlerevmSnapshotId);
    });
  });
}
