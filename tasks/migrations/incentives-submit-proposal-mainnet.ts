import { formatEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { DRE, latestBlock } from '../../helpers/misc-utils';
import { IERC20__factory, IGovernancePowerDelegationToken__factory } from '../../types';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import isIPFS from 'is-ipfs';

const {
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  IPFS_HASH = '', // PENDING
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
  AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5', // mainnet
} = process.env;

task('incentives-submit-proposal:mainnet', 'Submit the incentives proposal to Aave Governance')
  .addParam('proposalExecutionPayload')
  .addParam('aTokens')
  .addParam('variableDebtTokens')
  .setAction(async ({ proposalExecutionPayload, aTokens, variableDebtTokens }, localBRE) => {
    await localBRE.run('set-DRE');

    const { signer: proposerRelay, address: proposerAddress } = await getDefenderRelaySigner();

    if (!AAVE_TOKEN || !IPFS_HASH || !AAVE_GOVERNANCE_V2 || !AAVE_SHORT_EXECUTOR) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    // Initialize contracts and tokens
    const gov = (await DRE.ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposerRelay
    )) as IAaveGovernanceV2;

    const aave = IERC20__factory.connect(AAVE_TOKEN, proposerRelay);

    // Balance and proposal power check
    const balance = await aave.balanceOf(proposerAddress);
    const priorBlock = ((await latestBlock()) - 1).toString();
    const aaveGovToken = IGovernancePowerDelegationToken__factory.connect(
      AAVE_TOKEN,
      proposerRelay
    );
    const propositionPower = await aaveGovToken.getPowerAtBlock(proposerAddress, priorBlock, '1');

    console.log('- AAVE Balance proposer', formatEther(balance));
    console.log(
      `- Proposition power of ${proposerAddress} at block: ${priorBlock}`,
      formatEther(propositionPower)
    );

    if (!isIPFS.multihash(IPFS_HASH)) {
      console.log('Please check IPFS_HASH env variable due is not valid ipfs multihash.');
      throw Error('IPFS_HASH is not valid');
    }
    // Submit proposal
    const proposalId = await gov.getProposalsCount();
    const proposalParams = {
      proposalExecutionPayload,
      aTokens,
      variableDebtTokens,
      aaveGovernance: AAVE_GOVERNANCE_V2,
      shortExecutor: AAVE_SHORT_EXECUTOR,
      ipfsHash: IPFS_HASH,
      defender: true,
    };
    console.log('- Submitting proposal with following params:');
    console.log(JSON.stringify(proposalParams, null, 2));

    await DRE.run('propose-incentives', proposalParams);
    console.log('- Proposal Submited:', proposalId.toString());
  });
