import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { expect } from 'chai';
import { BigNumber, utils } from 'ethers';
import rawHRE from 'hardhat';
import { deploySelfDestruct } from '../helpers/contracts-accessors';
import {
  advanceBlockTo,
  DRE,
  impersonateAccountsHardhat,
  increaseTime,
  latestBlock,
} from '../helpers/misc-utils';
import { tEthereumAddress } from '../helpers/types';
import {
  IAaveGovernanceV2,
  IERC20,
  IAaveIncentivesController,
  ProposalIncentivesRev2Executor__factory,
} from '../types';

const AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c';
const AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5';
const AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9';
const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';
const VOTING_DURATION = 19200;

describe('Upgrade to and test Revision #2 of the implementation', () => {
  let ethers;

  let gov: IAaveGovernanceV2;
  let incentivesController: IAaveIncentivesController;
  let aave: IERC20;
  let aaveWhale: SignerWithAddress, proposer: SignerWithAddress;
  let proposalExecutionPayload: tEthereumAddress;
  let proposalId: BigNumber;

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = DRE.ethers;
    [proposer] = await ethers.getSigners();

    // Define ERC20 tokens
    aave = (await ethers.getContractAt(
      '@aave/protocol-v2/contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
      AAVE_TOKEN
    )) as IERC20;

    // Define system contracts
    incentivesController = (await ethers.getContractAt(
      'StakedTokenIncentivesController',
      INCENTIVES_PROXY
    )) as IAaveIncentivesController;
    gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;

    // Deploy the executor contract
    const proposalIncentivesRev2Executor = await new ProposalIncentivesRev2Executor__factory(
      proposer
    ).deploy();
    // await proposalIncentivesRev2Executor.deployTransaction.wait();
    proposalExecutionPayload = proposalIncentivesRev2Executor.address;

    // Spoof signer for AAVE_WHALE
    await impersonateAccountsHardhat([AAVE_WHALE]);
    aaveWhale = ethers.provider.getSigner(AAVE_WHALE);

    // Seed AAVE_WHALE with some ETH for gas
    const selfDestructContract = await deploySelfDestruct();
    await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
      value: ethers.utils.parseEther('10'),
    });

    // Transfer enough AAVE to proposer
    await (
      await aave.connect(aaveWhale).transfer(proposer.address, utils.parseEther('2000000'))
    ).wait();
  });

  it('Incentives implementation should be rev1', async () => {
    expect(await incentivesController.REVISION()).to.be.equal(1);
  });

  it('Proposal should be created', async () => {
    await advanceBlockTo((await latestBlock()) + 10);

    try {
      const balance = await aave.balanceOf(proposer.address);
      console.log('AAVE Balance proposer', utils.formatEther(balance));
    } catch (error) {
      console.log(error);
    }

    // Submit proposal
    proposalId = await gov.getProposalsCount();

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

    // Mine block due flash loan voting protection
    await advanceBlockTo((await latestBlock()) + 1);

    // Submit vote and advance block to Queue phase
    await (await gov.submitVote(proposalId, true)).wait();
    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);
  });

  it('Proposal should be queued', async () => {
    // Queue and advance block to Execution phase
    await (await gov.queue(proposalId)).wait();
    let proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(5);

    await increaseTime(86400 + 10);
  });

  it('Proposal should be executed', async () => {
    // Execute payload
    try {
      await (await gov.execute(proposalId, { gasLimit: 3000000 })).wait();
    } catch (error) {
      console.log(error);
    }

    console.log('Proposal executed');

    const proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(7);
  });

  it('Incentives implementation should be rev2', async () => {
    expect(await incentivesController.REVISION()).to.be.equal(2);
  });
});
