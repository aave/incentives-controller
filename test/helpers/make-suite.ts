import { evmRevert, evmSnapshot, DRE, impersonateAccountsHardhat } from '../../helpers/misc-utils';
import { constants, Signer, utils } from 'ethers';
import { deploySelfDestruct } from '../../helpers/contracts-accessors';
import { getEthersSigners } from '../../helpers/contracts-helpers';
import { tEthereumAddress } from '../../helpers/types';

import chai from 'chai';
// @ts-ignore
import bignumberChai from 'chai-bignumber';
import { getATokenMock } from '../../helpers/contracts-accessors';
import { MintableErc20 } from '../../types/MintableErc20';
import { ATokenMock } from '../../types/ATokenMock';
import { StakedAaveV3, StakedTokenIncentivesController } from '../../types';

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
  aaveIncentivesController: StakedTokenIncentivesController;
  stakedAave: StakedAaveV3;
  aDaiMock: ATokenMock;
  aWethMock: ATokenMock;
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
  stakedAave: {} as StakedAaveV3,
  aaveIncentivesController: {} as StakedTokenIncentivesController,
  aDaiMock: {} as ATokenMock,
  aWethMock: {} as ATokenMock,
} as TestEnv;

export async function initializeMakeSuite(
  aaveToken: MintableErc20,
  stakedAave: StakedAaveV3,
  aaveIncentivesController: StakedTokenIncentivesController
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
}

export function makeSuite(name: string, tests: (testEnv: TestEnv) => void) {
  describe(name, () => {
    before(async () => {
      setBuidlerevmSnapshotId(await evmSnapshot());

      // Below mocks the behavior of V1 StakedTokenIncentivesController.initialize(),
      // which grants max allowance of AAVE to the stkAAVE contract

      // Impersonate incentives controller
      await impersonateAccountsHardhat([testEnv.aaveIncentivesController.address]);
      const incentivesControllerAsSigner = DRE.ethers.provider.getSigner(
        testEnv.aaveIncentivesController.address
      );

      // Seed incentives controller with eth
      const selfDestructContract = await deploySelfDestruct();
      await selfDestructContract.destroyAndTransfer(testEnv.aaveIncentivesController.address, {
        value: utils.parseEther('10'),
      });

      // Grants max allowance of incentives controller's AAVE to the stkAAVE contract
      await testEnv.aaveToken
        .connect(incentivesControllerAsSigner)
        .approve(testEnv.stakedAave.address, constants.MaxUint256);
    });
    tests(testEnv);
    after(async () => {
      await evmRevert(buidlerevmSnapshotId);
    });
  });
}
