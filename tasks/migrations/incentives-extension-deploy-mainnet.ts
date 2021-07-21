import { task } from 'hardhat/config';
import { DRE } from '../../helpers/misc-utils';
import { tEthereumAddress } from '../../helpers/types';
import { getReserveConfigs } from '../../test-fork/helpers';
import { ProposalIncentivesExecutor__factory, IERC20Detailed__factory, IncentivesExtensionProposal__factory } from '../../types';
import { ILendingPool } from '../../types/ILendingPool';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from 'ethers';
import kebabCase from 'kebab-case';


const AAVE_LENDING_POOL = '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9';
const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';

task(
  'incentives-extension-deploy:mainnet',
  'Deploy the payload contract, atokens and variable debt token implementations. Print the params for submitting proposal'
)
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE) => {

    await localBRE.run('set-DRE');

    let deployer: Signer;
    [deployer] = await DRE.ethers.getSigners();

    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      deployer = signer;
    }

    const ethers = DRE.ethers;

    // Deploy Proposal Executor Payload
    const {
      address: proposalExecutionPayloadAddress,
    } = await new IncentivesExtensionProposal__factory(deployer).deploy();

    console.log('Deployed IncentiveExtensionProposal at:', proposalExecutionPayloadAddress);

    console.log('- Finished deployment script');

    console.log('=== INFO ===');
    console.log('Proposal payload:', proposalExecutionPayloadAddress);
    console.log(
      'Needed params to submit the proposal at the following task: ',
      '$ npx hardhat --network main incentives-submit-proposal:mainnet'
    );
    /*
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
    );*/

    await DRE.run('verify-extension-proposal-etherscan', {
      proposalPayloadAddress: proposalExecutionPayloadAddress,
    });
  });
