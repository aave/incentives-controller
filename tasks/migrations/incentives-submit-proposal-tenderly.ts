import { formatEther, parseEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { advanceBlockTo, DRE, increaseTime, latestBlock } from '../../helpers/misc-utils';
import { IERC20__factory, IGovernancePowerDelegationToken__factory } from '../../types';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import isIPFS from 'is-ipfs';
import { Signer } from '@ethersproject/abstract-signer';
import { logError } from '../../helpers/tenderly-utils';

const {
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
  AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5', // mainnet
} = process.env;
const VOTING_DURATION = 19200;

const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';

task('incentives-submit-proposal:tenderly', 'Submit the incentives proposal to Aave Governance')
  .addParam('proposalExecutionPayload')
  .addParam('aTokens')
  .addParam('variableDebtTokens')
  .addFlag('defender')
  .setAction(
    async ({ defender, proposalExecutionPayload, aTokens, variableDebtTokens }, localBRE) => {
      await localBRE.run('set-DRE');
      let proposer: Signer;
      [proposer] = await DRE.ethers.getSigners();

      const { signer } = await getDefenderRelaySigner();
      proposer = signer;

      const whale = DRE.ethers.provider.getSigner(AAVE_WHALE);
      const aave = IERC20__factory.connect(AAVE_TOKEN, whale);

      // Transfer enough AAVE to proposer
      await (await aave.transfer(await proposer.getAddress(), parseEther('2000000'))).wait();

      if (!AAVE_TOKEN || !AAVE_GOVERNANCE_V2 || !AAVE_SHORT_EXECUTOR) {
        throw new Error(
          'You have not set correctly the .env file, make sure to read the README.md'
        );
      }

      if (aTokens.split(',').length !== 6) {
        throw new Error('aTokens input param should have 6 elements');
      }

      if (variableDebtTokens.split(',').length !== 6) {
        throw new Error('variable debt token param should have 6 elements');
      }

      const proposerAddress = await proposer.getAddress();

      // Initialize contracts and tokens
      const gov = (await DRE.ethers.getContractAt(
        'IAaveGovernanceV2',
        AAVE_GOVERNANCE_V2,
        proposer
      )) as IAaveGovernanceV2;

      // Balance and proposal power check
      const balance = await aave.balanceOf(proposerAddress);
      const priorBlock = ((await latestBlock()) - 1).toString();
      const aaveGovToken = IGovernancePowerDelegationToken__factory.connect(AAVE_TOKEN, proposer);
      const propositionPower = await aaveGovToken.getPowerAtBlock(proposerAddress, priorBlock, '1');

      console.log('- AAVE Balance proposer', formatEther(balance));
      console.log(
        `- Proposition power of ${proposerAddress} at block: ${priorBlock}`,
        formatEther(propositionPower)
      );

      // Submit proposal
      const proposalId = await gov.getProposalsCount();
      const proposalParams = {
        proposalExecutionPayload,
        aTokens,
        variableDebtTokens,
        aaveGovernance: AAVE_GOVERNANCE_V2,
        shortExecutor: AAVE_SHORT_EXECUTOR,
        defender: true,
      };
      console.log('- Submitting proposal with following params:');
      console.log(JSON.stringify(proposalParams, null, 2));

      await DRE.run('propose-incentives', proposalParams);
      console.log('- Proposal Submited:', proposalId.toString());

      // Mine block due flash loan voting protection
      await advanceBlockTo((await latestBlock()) + 1);

      // Submit vote and advance block to Queue phase
      try {
        console.log('Submitting vote...');
        await (await gov.submitVote(proposalId, true)).wait();
        console.log('Voted');
      } catch (error) {
        logError();
        throw error;
      }

      await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

      try {
        // Queue and advance block to Execution phase
        console.log('Queueing');
        await (await gov.queue(proposalId, { gasLimit: 3000000 })).wait();
        console.log('Queued');
      } catch (error) {
        logError();
        throw error;
      }
      await increaseTime(86400 + 10);

      // Execute payload

      try {
        console.log('Executing');
        await (await gov.execute(proposalId, { gasLimit: 6000000 })).wait();
      } catch (error) {
        logError();
        throw error;
      }
      console.log('Proposal executed');
    }
  );
