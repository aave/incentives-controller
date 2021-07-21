import { expect } from 'chai';
import rawHRE from 'hardhat';
import { BigNumber } from 'ethers';
import { formatEther, parseEther, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { JsonRpcSigner } from '@ethersproject/providers';

import { DRE } from '../helpers/misc-utils';
import {
  increaseTime,
  latestBlock,
  advanceBlockTo,
  impersonateAccountsHardhat,
} from '../helpers/misc-utils';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../helpers/constants';
import { IERC20 } from '../types/IERC20';
import { IAaveGovernanceV2 } from '../types/IAaveGovernanceV2';
import { ILendingPool } from '../types/ILendingPool';
import {
  AToken,
  IncentivesExtensionProposal__factory,
  SelfdestructTransfer__factory,
} from '../types';
import { tEthereumAddress } from '../helpers/types';
import { IERC20Factory } from '../types/IERC20Factory';
import { IATokenFactory } from '../types/IATokenFactory';
import { getRewards } from '../test/DistributionManager/data-helpers/base-math';
import { getUserIndex } from '../test/DistributionManager/data-helpers/asset-user-data';
import { IERC20DetailedFactory } from '../types/IERC20DetailedFactory';
import { fullCycleLendingPool, getReserveConfigs, spendList } from './helpers';
import { deployAaveIncentivesController, getIncentivesController } from '../helpers/contracts-accessors';
import { IGovernancePowerDelegationTokenFactory } from '../types/IGovernancePowerDelegationTokenFactory';
import { logError } from '../helpers/tenderly-utils';
import { getFirstSigner } from '../helpers/contracts-helpers';

const {
  RESERVES = 'DAI,GUSD,USDC,USDT,WBTC,WETH',
  POOL_CONFIGURATOR = '0x311bb771e4f8952e6da169b425e7e92d6ac45756',
  POOL_PROVIDER = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  POOL_DATA_PROVIDER = '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
  ECO_RESERVE = '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  TREASURY = '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  IPFS_HASH = 'QmT9qk3CRYbFDWpDFYeAv8T8H1gnongwKhh5J68NLkLir6',
  INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5',
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
  AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5', // mainnet
} = process.env;

if (
  !RESERVES ||
  !POOL_CONFIGURATOR ||
  !POOL_DATA_PROVIDER ||
  !ECO_RESERVE ||
  !AAVE_TOKEN ||
  !IPFS_HASH ||
  !AAVE_GOVERNANCE_V2 ||
  !AAVE_SHORT_EXECUTOR ||
  !TREASURY
) {
  throw new Error('You have not set correctly the .env file, make sure to read the README.md');
}

const AAVE_LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const VOTING_DURATION = 19200;

const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';

const AAVE_STAKE = '0x4da27a545c0c5B758a6BA100e3a049001de870f5';
const DAI_TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const DAI_HOLDER = '0x72aabd13090af25dbb804f84de6280c697ed1150';

describe('Enable incentives in target assets', () => {
  let ethers;

  let whale: JsonRpcSigner;
  let daiHolder: JsonRpcSigner;
  let proposer: SignerWithAddress;
  let incentivesProxyAdmin: SignerWithAddress;
  let incentivesProxy: tEthereumAddress;
  let gov: IAaveGovernanceV2;
  let pool: ILendingPool;
  let aave: IERC20;
  let stkAave: IERC20;
  let dai: IERC20;
  let aDAI: AToken;
  let variableDebtDAI: IERC20;
  let proposalId: BigNumber;
  let aTokensImpl: tEthereumAddress[];
  let variableDebtTokensImpl: tEthereumAddress[];
  let proposalExecutionPayload: tEthereumAddress;
  let symbols: {
    [key: string]: {
      aToken: { symbol: string; name: string };
      variableDebtToken: { symbol: string; name: string };
    };
  } = {};

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = DRE.ethers;
    [proposer, incentivesProxyAdmin] = await DRE.ethers.getSigners();

    // Deploy incentives implementation
    const { address: incentivesImplementation } = await deployAaveIncentivesController([
      AAVE_STAKE,
      AAVE_SHORT_EXECUTOR,
    ]);

    incentivesProxy = INCENTIVES_PROXY;

    // Deploy Proposal Executor Payload
    const {
      address: proposalExecutionPayloadAddress,
    } = await new IncentivesExtensionProposal__factory(proposer).deploy();
    proposalExecutionPayload = proposalExecutionPayloadAddress;
    // Send ether to the AAVE_WHALE, which is a non payable contract via selfdestruct
    const selfDestructContract = await new SelfdestructTransfer__factory(proposer).deploy();
    await (
      await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
        value: ethers.utils.parseEther('1'),
      })
    ).wait();
    await impersonateAccountsHardhat([
      AAVE_WHALE,
      ...Object.keys(spendList).map((k) => spendList[k].holder),
    ]);

    // Impersonating holders
    whale = ethers.provider.getSigner(AAVE_WHALE);
    daiHolder = ethers.provider.getSigner(DAI_HOLDER);

    // Initialize contracts and tokens
    gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;

    aave = IERC20Factory.connect(AAVE_TOKEN, whale);
    stkAave = IERC20Factory.connect(AAVE_STAKE, proposer);

    const balance = await aave.balanceOf("0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5");
    console.log("Balance incentives controller is", balance.toString());

    // Transfer enough AAVE to proposer
    await (await aave.transfer(proposer.address, parseEther('2000000'))).wait();
  });

  it('Proposal should be created', async () => {
    await advanceBlockTo((await latestBlock()) + 10);

    try {
      const balance = await aave.balanceOf(proposer.address);
      console.log('AAVE Balance proposer', formatEther(balance));
      const aaveGovToken = IGovernancePowerDelegationTokenFactory.connect(AAVE_TOKEN, proposer);
      const propositionPower = await aaveGovToken.getPowerAtBlock(
        proposer.address,
        ((await latestBlock()) - 1).toString(),
        '1'
      );

      console.log(
        `Proposition power of ${proposer.address} at block - 1`,
        formatEther(propositionPower)
      );
    } catch (error) {
      console.log(error);
    }
    // Submit proposal
    proposalId = await gov.getProposalsCount();

    // Submit proposal

    const executeSignature = 'execute()';
    const ipfsEncoded = '0xca55ea7db44a796d879b9325f5a3b13a2bcc1cd95d290c65983086516bda3c9b';
    try {
      const tx = await gov.create(
        AAVE_SHORT_EXECUTOR,
        ["0x2FcdE9dD21e32005836E195BeE8D8c973E272289"],
        ['0'],
        [executeSignature],
        ['0x'],
        [true],
        ipfsEncoded,
        { gasLimit: 3000000 }
      );
      console.log('- Proposal submitted to Governance');
      await tx.wait();
    } catch (error) {
      throw error;
    }

    console.log('submited');

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
      logError();
      throw error;
    }

    console.log('Proposal executed');

    const proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(7);
  });

  it('Check incentives controller AAVE balance and the end date', async () => {

    const balance = await aave.balanceOf(INCENTIVES_PROXY);
    console.log("Balance is", balance.toString());

    const proposerBalance = await aave.balanceOf(proposer.address);

    console.log("Proposer balance ", proposerBalance.toString());

    const incentivesController = await getIncentivesController(INCENTIVES_PROXY);

    const distEnd = await incentivesController.connect(await getFirstSigner()).DISTRIBUTION_END();

    console.log("Distribution end is ", distEnd.toString());

  });
});
