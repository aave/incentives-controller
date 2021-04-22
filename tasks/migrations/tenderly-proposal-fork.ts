import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { formatEther, parseEther } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { JsonRpcSigner } from '@ethersproject/providers';
import { task } from 'hardhat/config';
import { DRE, advanceBlockTo, latestBlock, increaseTime } from '../../helpers/misc-utils';
import { tEthereumAddress } from '../../helpers/types';
import { getReserveConfigs } from '../../test-fork/helpers';
import {
  ProposalIncentivesExecutor__factory,
  SelfdestructTransfer__factory,
  IERC20Detailed__factory,
  IERC20__factory,
  IGovernancePowerDelegationToken__factory,
} from '../../types';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { ILendingPool } from '../../types/ILendingPool';

const {
  RESERVES = 'DAI,GUSD,USDC,USDT,WBTC,WETH',
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

const DAI_TOKEN = '0x6b175474e89094c44da98b954eedeac495271d0f';
const DAI_HOLDER = '0x72aabd13090af25dbb804f84de6280c697ed1150';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';

task('incentives-proposal:tenderly', 'Spin a tenderly fork with incentives activated').setAction(
  async (_, localBRE) => {
    let ethers;
    let whale: JsonRpcSigner;
    let daiHolder: JsonRpcSigner;
    let proposer: SignerWithAddress;
    let incentivesProxyAdmin: SignerWithAddress;
    let incentivesProxy: tEthereumAddress;
    let gov: IAaveGovernanceV2;
    let pool: ILendingPool;
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

    if (!localBRE.network.name.includes('tenderly')) {
      console.error('You must connect to tenderly via --network tenderly to use this task.');
      throw Error('tenderly-network-missing');
    }

    await localBRE.run('set-DRE');

    ethers = DRE.ethers;
    [proposer, incentivesProxyAdmin] = await DRE.ethers.getSigners();

    incentivesProxy = INCENTIVES_PROXY;

    // Deploy aTokens and debt tokens
    const { aTokens, variableDebtTokens } = await DRE.run('deploy-reserve-implementations', {
      provider: POOL_PROVIDER,
      assets: RESERVES,
      incentivesController: incentivesProxy,
      treasury: TREASURY,
    });

    aTokensImpl = [...aTokens];
    variableDebtTokensImpl = [...variableDebtTokens];

    // Deploy Proposal Executor Payload
    const {
      address: proposalExecutionPayloadAddress,
    } = await new ProposalIncentivesExecutor__factory(proposer).deploy();
    proposalExecutionPayload = proposalExecutionPayloadAddress;
    // Send ether to the AAVE_WHALE, which is a non payable contract via selfdestruct
    const selfDestructContract = await new SelfdestructTransfer__factory(proposer).deploy();
    await (
      await selfDestructContract.destroyAndTransfer(AAVE_WHALE, {
        value: ethers.utils.parseEther('1'),
      })
    ).wait();

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

    const aave = IERC20__factory.connect(AAVE_TOKEN, whale);
    const dai = IERC20__factory.connect(DAI_TOKEN, daiHolder);

    // Transfer enough AAVE to proposer
    await (await aave.transfer(proposer.address, parseEther('2000000'))).wait();

    // Transfer DAI to repay future DAI loan
    await (await dai.transfer(proposer.address, parseEther('100000'))).wait();

    // Save aToken and debt token names
    const reserveConfigs = await getReserveConfigs(POOL_PROVIDER, RESERVES, proposer);

    for (let x = 0; x < reserveConfigs.length; x++) {
      const { tokenAddress, symbol } = reserveConfigs[x];
      const { aTokenAddress, variableDebtTokenAddress } = await pool.getReserveData(tokenAddress);
      const aToken = IERC20Detailed__factory.connect(aTokenAddress, proposer);
      const varDebtToken = IERC20Detailed__factory.connect(variableDebtTokenAddress, proposer);

      symbols[symbol] = {
        aToken: {
          name: await aToken.name(),
          symbol: await aToken.symbol(),
        },
        variableDebtToken: {
          name: await varDebtToken.name(),
          symbol: await varDebtToken.symbol(),
        },
      };
    }

    await advanceBlockTo((await latestBlock()) + 10);

    const balance = await aave.balanceOf(proposer.address);
    console.log('AAVE Balance proposer', formatEther(balance));
    const aaveGovToken = IGovernancePowerDelegationToken__factory.connect(AAVE_TOKEN, proposer);
    const propositionPower = await aaveGovToken.getPowerAtBlock(
      proposer.address,
      ((await latestBlock()) - 1).toString(),
      '1'
    );

    console.log(
      `Proposition power of ${proposer.address} at block - 1`,
      formatEther(propositionPower)
    );
    // Submit proposal
    proposalId = await gov.getProposalsCount();

    await DRE.run('propose-incentives', {
      proposalExecutionPayload,
      aTokens: aTokensImpl.join(','),
      variableDebtTokens: variableDebtTokensImpl.join(','),
      aaveGovernance: AAVE_GOVERNANCE_V2,
      shortExecutor: AAVE_SHORT_EXECUTOR,
      ipfsHash: IPFS_HASH,
    });
    console.log('- Proposal Submited');

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

    // Execute payload
    await (await gov.execute(proposalId)).wait();
    console.log('Proposal executed');

    console.log('=== INFO ===');
    console.log('Proposal payload:', proposalExecutionPayloadAddress);
    console.log('Incentives Controller proxy:', incentivesProxy);
  }
);
