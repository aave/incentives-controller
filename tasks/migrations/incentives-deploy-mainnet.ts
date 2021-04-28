import { task } from 'hardhat/config';
import { DRE } from '../../helpers/misc-utils';
import { tEthereumAddress } from '../../helpers/types';
import { getReserveConfigs } from '../../test-fork/helpers';
import { ProposalIncentivesExecutor__factory, IERC20Detailed__factory } from '../../types';
import { ILendingPool } from '../../types/ILendingPool';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from 'ethers';
import kebabCase from 'kebab-case';

const {
  RESERVES = 'DAI,GUSD,USDC,USDT,WBTC,WETH',
  POOL_PROVIDER = '0xB53C1a33016B2DC2fF3653530bfF1848a515c8c5',
  POOL_DATA_PROVIDER = '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  TREASURY = '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
  AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5', // mainnet
} = process.env;

const AAVE_LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';

task(
  'incentives-deploy:mainnet',
  'Deploy the payload contract, atokens and variable debt token implementations. Print the params for submitting proposal'
)
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE) => {
    let aTokensImpl: tEthereumAddress[];
    let variableDebtTokensImpl: tEthereumAddress[];
    let proposalExecutionPayload: tEthereumAddress;
    let symbols: {
      [key: string]: {
        aToken: { symbol: string; name: string };
        variableDebtToken: { symbol: string; name: string };
      };
    } = {};

    await localBRE.run('set-DRE');

    let deployer: Signer;
    [deployer] = await DRE.ethers.getSigners();

    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      deployer = signer;
    }

    const ethers = DRE.ethers;

    const incentivesProxy = INCENTIVES_PROXY;

    if (
      !RESERVES ||
      !POOL_DATA_PROVIDER ||
      !AAVE_TOKEN ||
      !AAVE_GOVERNANCE_V2 ||
      !AAVE_SHORT_EXECUTOR ||
      !TREASURY
    ) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    console.log('- Deploying aTokens and Variable Debt Tokens implementations');

    // Deploy aTokens and debt tokens
    const { aTokens, variableDebtTokens } = await DRE.run('deploy-reserve-implementations', {
      provider: POOL_PROVIDER,
      assets: RESERVES,
      incentivesController: incentivesProxy,
      treasury: TREASURY,
      defender: true,
    });

    aTokensImpl = [...aTokens];
    variableDebtTokensImpl = [...variableDebtTokens];

    // Deploy Proposal Executor Payload
    const {
      address: proposalExecutionPayloadAddress,
    } = await new ProposalIncentivesExecutor__factory(deployer).deploy();
    proposalExecutionPayload = proposalExecutionPayloadAddress;

    console.log('Deployed ProposalIncentivesExecutor at:', proposalExecutionPayloadAddress);

    console.log('- Finished deployment script');

    console.log('=== INFO ===');
    console.log('Proposal payload:', proposalExecutionPayloadAddress);
    console.log('Incentives Controller proxy:', incentivesProxy);
    console.log(
      'Needed params to submit the proposal at the following task: ',
      '$ npx hardhat --network main incentives-submit-proposal:mainnet'
    );
    const proposalParams = {
      proposalExecutionPayload,
      aTokens: aTokensImpl.join(','),
      variableDebtTokens: variableDebtTokensImpl.join(','),
    };
    console.log(
      `--defender `,
      Object.keys(proposalParams)
        .map((str) => `--${kebabCase(str)} ${proposalParams[str]}`)
        .join(' ')
    );

    await DRE.run('verify-proposal-etherscan', {
      assets: RESERVES,
      aTokens: aTokensImpl.join(','),
      variableDebtTokens: variableDebtTokensImpl.join(','),
      proposalPayloadAddress: proposalExecutionPayloadAddress,
    });
  });
