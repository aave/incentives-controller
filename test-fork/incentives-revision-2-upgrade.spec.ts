import { JsonRpcSigner } from '@ethersproject/providers';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { BigNumber, constants, utils } from 'ethers';
import rawHRE from 'hardhat';
import { Address } from 'hardhat-deploy/dist/types';
import { deploySelfDestruct } from '../helpers/contracts-accessors';
import {
  advanceBlockTo,
  DRE,
  impersonateAccountsHardhat,
  increaseTime,
  latestBlock,
  timeLatest,
} from '../helpers/misc-utils';
import { getUserIndex } from '../test/DistributionManager/data-helpers/asset-user-data';
import { getRewards } from '../test/DistributionManager/data-helpers/base-math';
import {
  IAaveGovernanceV2,
  IAaveIncentivesController,
  IERC20,
  ILendingPool,
  ILendingPoolAddressesProvider,
  ProposalIncentivesV2Executor__factory,
  StakedTokenIncentivesController,
} from '../types';

const AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c';
const AAVE_LENDING_POOL_ADDRESSES_PROVIDER = '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5';
const AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';

const AAVE_DAI_TOKEN = '0x028171bCA77440897B824Ca71D1c56caC55b68A3';
const AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9';
const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
const DAI_TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const DAI_WHALE = '0x1e3d6eab4bcf24bcd04721caa11c478a2e59852d';
const STAKED_AAVE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';

describe('Upgrade to and test Revision #2 of the implementation', () => {
  const VOTING_DURATION = 19200;

  let ethers;

  let gov: IAaveGovernanceV2;
  let incentives: IAaveIncentivesController, pool: ILendingPool;
  let aave: IERC20, aDai: IERC20, dai: IERC20, stkAave: IERC20, rewardsAssets: Address[];
  let aaveWhale: SignerWithAddress,
    claimer: SignerWithAddress,
    daiWhale: JsonRpcSigner,
    proposer: SignerWithAddress;
  let preUpgradeRewardsBalance: BigNumber;
  let rewardsAccrualDuration: number;

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = DRE.ethers;
    [claimer, proposer] = await ethers.getSigners();

    // Define ERC20 tokens
    aave = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      AAVE_TOKEN
    )) as IERC20;
    aDai = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/protocol/tokenization/AToken.sol:AToken',
      AAVE_DAI_TOKEN
    )) as IERC20;
    dai = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      DAI_TOKEN
    )) as IERC20;
    stkAave = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      STAKED_AAVE
    )) as IERC20;

    // Define system contracts
    gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;
    incentives = (await ethers.getContractAt(
      'StakedTokenIncentivesController',
      INCENTIVES_PROXY
    )) as IAaveIncentivesController;
    const poolAddressesProvider = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/interfaces/ILendingPoolAddressesProvider.sol:ILendingPoolAddressesProvider',
      AAVE_LENDING_POOL_ADDRESSES_PROVIDER
    )) as ILendingPoolAddressesProvider;
    pool = (await ethers.getContractAt(
      'ILendingPool',
      await poolAddressesProvider.getLendingPool()
    )) as ILendingPool;

    // Spoof signers for the necessary accounts
    await impersonateAccountsHardhat([AAVE_WHALE, DAI_WHALE]);
    aaveWhale = ethers.provider.getSigner(AAVE_WHALE);
    daiWhale = ethers.provider.getSigner(DAI_WHALE);

    // Seed the impersonated accounts with some ETH for gas
    for (const ethBeneficiary of [AAVE_WHALE, DAI_WHALE]) {
      const selfDestructContract = await deploySelfDestruct();
      await selfDestructContract.destroyAndTransfer(ethBeneficiary, {
        value: ethers.utils.parseEther('10'),
      });
    }

    rewardsAssets = [aDai.address];
  });

  it('pre-upgrade: starts to accrue rewards', async () => {
    // Seed claimer with DAI
    const daiDepositAmount = ethers.utils.parseEther('10000');
    await dai.connect(daiWhale).transfer(claimer.address, daiDepositAmount);

    // Deposit DAI for aDAI
    await dai.connect(claimer).approve(pool.address, daiDepositAmount);
    await pool.connect(claimer).deposit(dai.address, daiDepositAmount, claimer.address, 0);
    expect(await aDai.balanceOf(claimer.address)).to.be.gt(0);

    // Claim all rewards to zero out previously-accrued rewards
    await incentives
      .connect(claimer)
      .claimRewards(rewardsAssets, constants.MaxUint256, claimer.address);

    // This will accrue rewards during the time it takes to perform the upgrade process
  });

  it('upgrades', async () => {
    const blocktimePreUpgrade = await timeLatest();

    // Deploy the executor contract
    const proposalIncentivesRev2Executor = await new ProposalIncentivesV2Executor__factory(
      proposer
    ).deploy();
    const proposalExecutionPayload = proposalIncentivesRev2Executor.address;

    // Seed proposer with AAVE
    await (
      await aave.connect(aaveWhale).transfer(proposer.address, utils.parseEther('2000000'))
    ).wait();

    // 1. Create proposal

    await advanceBlockTo((await latestBlock()) + 10);

    try {
      const balance = await aave.balanceOf(proposer.address);
      console.log('AAVE Balance proposer', utils.formatEther(balance));
    } catch (error) {
      console.log(error);
    }

    const proposalId = await gov.getProposalsCount();

    // Not the actual ipfsHash
    const ipfsHash = '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949';

    try {
      const tx = await gov.create(
        AAVE_SHORT_EXECUTOR,
        [proposalExecutionPayload],
        ['0'],
        ['execute()'],
        ['0x'],
        [true],
        ipfsHash,
        { gasLimit: 3000000 }
      );
      console.log('- Proposal submitted to Governance');
      await tx.wait();
      console.log('submitted');
    } catch (error) {
      console.log(error);
    }

    // 2. Queue proposal

    // Mine block due flash loan voting protection
    await advanceBlockTo((await latestBlock()) + 1);

    // Submit vote and advance block to Queue phase
    await (await gov.submitVote(proposalId, true)).wait();
    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    // Queue and advance block to Execution phase
    await (await gov.queue(proposalId)).wait();
    let proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(5);

    await increaseTime(86400 + 10);

    // Prior to executing the proposal, checkpoint the user's owed rewards
    preUpgradeRewardsBalance = await incentives.getRewardsBalance(rewardsAssets, claimer.address);
    expect(preUpgradeRewardsBalance).to.be.gt(0);

    rewardsAccrualDuration = (await timeLatest()).minus(blocktimePreUpgrade).toNumber();

    // 3. Execute proposal

    try {
      await (await gov.execute(proposalId, { gasLimit: 3000000 })).wait();
    } catch (error) {
      console.log(error);
    }

    console.log('Proposal executed');

    proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(7);

    // Revision number should be updated
    expect(await incentives.REVISION()).to.be.equal(2);
  });

  it('post-upgrade: continues to accrue rewards correctly, and allows aToken holder to claim incentives using claimRewardsToSelf()', async () => {
    // Tolerance for imprecise passage of time between actions
    const rewardsCorrectnessTolerance = 10 ** 12;

    // Rewards should be accruing for aDai
    expect((await incentives.getAssetData(aDai.address))[1]).to.be.gt(0);

    // Confirm the accrued rewards balance is more-or-less the same as pre-upgrade
    const postUpgradeRewardsBalance = await incentives.getRewardsBalance(
      rewardsAssets,
      claimer.address
    );
    expect(postUpgradeRewardsBalance).to.be.gte(preUpgradeRewardsBalance);
    expect(postUpgradeRewardsBalance).to.be.lte(
      preUpgradeRewardsBalance.add(rewardsCorrectnessTolerance)
    );

    // Wait for some time to accrue more rewards
    await increaseTime(rewardsAccrualDuration);

    // Rewards accrued post-upgrade should be the same as those accrued pre-upgrade (equal durations)
    const postUpgradeIncreasedTimeRewardsBalance = await incentives.getRewardsBalance(
      rewardsAssets,
      claimer.address
    );

    expect(postUpgradeIncreasedTimeRewardsBalance).to.be.gte(preUpgradeRewardsBalance.mul(2));
    expect(postUpgradeIncreasedTimeRewardsBalance).to.be.lte(
      preUpgradeRewardsBalance.mul(2).add(rewardsCorrectnessTolerance)
    );

    // Checkpoint claimer data prior to claim
    const aTokenBalance = await aDai.connect(claimer).scaledBalanceOf(claimer.address);
    const stkAaveBalanceBefore = await stkAave.balanceOf(claimer.address);
    const userIndexBefore = await getUserIndex(
      incentives as StakedTokenIncentivesController,
      claimer.address,
      aDai.address
    );

    // Claim rewards to self
    const tx = await incentives
      .connect(claimer)
      .claimRewardsToSelf(rewardsAssets, constants.MaxUint256);

    // Checkpoint claimer data post-claim
    const stkAaveBalanceAfter = await stkAave.balanceOf(claimer.address);
    const userIndexAfter = await getUserIndex(
      incentives as StakedTokenIncentivesController,
      claimer.address,
      aDai.address
    );

    // Assert the correct event emission
    expect(tx).to.emit(incentives, 'RewardsClaimed');

    // Assert the rewards accrued as expected
    expect(stkAaveBalanceAfter).to.be.gt(stkAaveBalanceBefore);
    const expectedAccruedRewards = getRewards(
      aTokenBalance,
      userIndexAfter,
      userIndexBefore
    ).toString();
    expect(stkAaveBalanceAfter.sub(stkAaveBalanceBefore)).to.be.eq(expectedAccruedRewards);
  });
});
