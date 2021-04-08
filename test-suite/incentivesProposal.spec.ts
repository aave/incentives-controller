import { expect } from 'chai';
import rawHRE from 'hardhat';
import { BigNumber } from 'ethers';
import { parseEther } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { JsonRpcSigner } from '@ethersproject/providers';

import { DRE, waitForTx } from '../helpers/misc-utils';
import {
  evmSnapshot,
  increaseTime,
  evmRevert,
  latestBlock,
  advanceBlockTo,
  impersonateAccountsHardhat,
} from '../helpers/misc-utils';
import { MAX_UINT_AMOUNT, ZERO_ADDRESS } from '../helpers/constants';
import { IERC20 } from '../types/IERC20';
import { IAaveGovernanceV2 } from '../types/IAaveGovernanceV2';
import { ILendingPool } from '../types/ILendingPool';
import {
  AaveIncentivesControllerFactory,
  InitializableAdminUpgradeabilityProxyFactory,
} from '../types';
import { parse } from 'dotenv/types';

const {
  RESERVES = 'USDT,USDC,DAI,WETH,WBTC,GUSD',
  POOL_CONFIGURATOR = '0x311bb771e4f8952e6da169b425e7e92d6ac45756',
  POOL_PROVIDER = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  POOL_DATA_PROVIDER = '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
  ECO_RESERVE = '0x25F2226B597E8F9514B3F68F00f494cF4f286491',
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  TREASURY = '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  IPFS_HASH = 'QmT9qk3CRYbFDWpDFYeAv8T8H1gnongwKhh5J68NLkLir6',
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
  let gov: IAaveGovernanceV2;
  let pool: ILendingPool;
  let aave: IERC20;
  let dai: IERC20;
  let aDAI: IERC20;
  let variableDebtDAI: IERC20;
  let snapshotId: string;
  let proposalId: BigNumber;

  afterEach(async () => {
    evmRevert(snapshotId);
    snapshotId = await evmSnapshot();
  });

  before(async () => {
    await rawHRE.run('set-DRE');
    ethers = DRE.ethers;
    [proposer, incentivesProxyAdmin] = await DRE.ethers.getSigners();

    // Deploy incentives implementation
    const { address: incentivesImplementation } = await DRE.deployments.deploy(
      'AaveIncentivesController',
      {
        from: proposer.address,
        args: [AAVE_TOKEN, AAVE_STAKE, '0', AAVE_SHORT_EXECUTOR],
      }
    );
    const incentivesInitParams = AaveIncentivesControllerFactory.connect(
      incentivesImplementation,
      proposer
    ).interface.encodeFunctionData('initialize', [ZERO_ADDRESS, '0', AAVE_SHORT_EXECUTOR]);

    // Deploy incentives proxy (Proxy Admin should be the provider, TBD)
    const { address: incentivesProxy } = await DRE.deployments.deploy(
      'InitializableAdminUpgradeabilityProxy',
      {
        from: proposer.address,
        args: [],
      }
    );

    // Initialize proxy for incentives controller
    const incentivesProxyInstance = InitializableAdminUpgradeabilityProxyFactory.connect(
      incentivesProxy,
      proposer
    );
    await waitForTx(
      await incentivesProxyInstance['initialize(address,address,bytes)'](
        incentivesImplementation,
        incentivesProxyAdmin.address,
        incentivesInitParams
      )
    );

    // Deploy aTokens and debt tokens
    const { aTokens, variableDebtTokens } = await rawHRE.run('deploy-reserve-implementations', {
      provider: POOL_PROVIDER,
      assets: RESERVES,
      incentivesController: incentivesProxy,
      treasury: TREASURY,
    });

    // Deploy Proposal Executor Payload
    await DRE.deployments.deploy('ProposalIncentivesExecutor', {
      from: proposer.address,
      args: [],
    });

    // Send ether to the AAVE_WHALE, which is a non payable contract via selfdestruct
    await DRE.deployments.deploy('SelfdestructTransfer', { from: proposer.address });
    const selfDestructAddress = (await DRE.deployments.get('SelfdestructTransfer')).address;
    const selfDestructContract = await ethers.getContractAt(
      'SelfdestructTransfer',
      selfDestructAddress
    );
    await (
      await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
        value: ethers.utils.parseEther('1'),
      })
    ).wait();
    await impersonateAccountsHardhat([AAVE_WHALE, DAI_HOLDER]);

    // Impersonating holders
    whale = ethers.provider.getSigner(AAVE_WHALE);
    daiHolder = ethers.provider.getSigner(DAI_HOLDER);

    // Initialize contracts and tokens
    gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;
    pool = (await ethers.getContractAt(
      'ILendingPool',
      AAVE_LENDING_POOL,
      proposer
    )) as ILendingPool;

    aave = (await ethers.getContractAt(
      '@aave/aave-stake/contracts/interfaces/IERC20.sol:IERC20',
      AAVE_TOKEN,
      whale
    )) as IERC20;
    dai = (await ethers.getContractAt(
      '@aave/aave-stake/contracts/interfaces/IERC20.sol:IERC20',
      DAI_TOKEN,
      daiHolder
    )) as IERC20;

    // Transfer enough AAVE to proposer
    await (await aave.transfer(proposer.address, parseEther('1000000'))).wait();

    // Transfer DAI to repay future DAI loan
    await (await dai.transfer(proposer.address, parseEther('10'))).wait();

    // Submit proposal
    proposalId = await gov.getProposalsCount();
    await DRE.run('propose-incentives', {
      incentivesProxy,
      aTokens: aTokens.join(','),
      variableDebtTokens: variableDebtTokens.join(','),
      aaveGovernance: AAVE_GOVERNANCE_V2,
      shortExecutor: AAVE_SHORT_EXECUTOR,
      ipfsHash: IPFS_HASH,
    });

    // Mine block due flash loan voting protection
    await DRE.ethers.provider.send('evm_mine', [0]);

    // Submit vote and advance block to Queue phase
    await (await gov.submitVote(proposalId, true)).wait();
    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    // Queue and advance block to Execution phase
    await (await gov.queue(proposalId)).wait();
    let proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(5);

    await increaseTime(86400 + 10);
    snapshotId = await evmSnapshot();
  });

  it('Should activate incentives to selected reserves', async () => {
    // Execute payload
    await (await gov.execute(proposalId)).wait();
    console.log('Proposal executed');

    const proposalState = await gov.getProposalState(proposalId);
    expect(proposalState).to.be.equal(7);
    const {
      configuration: { data },
      aTokenAddress,
      stableDebtTokenAddress,
      variableDebtTokenAddress,
    } = await pool.getReserveData(DAI_TOKEN);

    aDAI = (await ethers.getContractAt(
      '@aave/aave-stake/contracts/interfaces/IERC20.sol:IERC20',
      aTokenAddress,
      proposer
    )) as IERC20;
    variableDebtDAI = (await ethers.getContractAt(
      '@aave/aave-stake/contracts/interfaces/IERC20.sol:IERC20',
      variableDebtTokenAddress,
      proposer
    )) as IERC20;

    /*
    // Deposit DAI to LendingPool
    await (await dai.connect(proposer).approve(pool.address, parseEther('2000'))).wait();
    await (await pool.deposit(dai.address, parseEther('100'), proposer.address, 0)).wait();
    expect(await aDAI.balanceOf(proposer.address)).to.be.equal(parseEther('100'));
    */
    // Claim rewards TBD
  });
});
