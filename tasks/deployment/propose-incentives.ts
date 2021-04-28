import { task } from 'hardhat/config';
import { config } from 'dotenv';
import { IAaveGovernanceV2__factory } from '../../types';
import { Signer } from 'ethers';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bs58 = require('bs58');

config();

task('propose-incentives', 'Create some proposals and votes')
  .addParam('proposalExecutionPayload')
  .addParam('aTokens')
  .addParam('variableDebtTokens')
  .addParam('aaveGovernance')
  .addParam('shortExecutor')
  .addFlag('defender')
  .setAction(
    async (
      {
        aTokens,
        variableDebtTokens,
        aaveGovernance,
        shortExecutor,
        proposalExecutionPayload,
        defender,
      },
      localBRE: any
    ) => {
      await localBRE.run('set-DRE');

      let proposer: Signer;
      [proposer] = await localBRE.ethers.getSigners();

      if (defender) {
        const { signer } = await getDefenderRelaySigner();
        proposer = signer;
      }

      aTokens = aTokens.split(',');
      variableDebtTokens = variableDebtTokens.split(',');

      const callData = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address[6]', 'address[6]'],
        [aTokens, variableDebtTokens]
      );

      const executeSignature = 'execute(address[6],address[6])';
      const gov = await IAaveGovernanceV2__factory.connect(aaveGovernance, proposer);
      const ipfsEncoded = '0xf7a1f565fcd7684fba6fea5d77c5e699653e21cb6ae25fbf8c5dbc8d694c7949';

      try {
        const tx = await gov.create(
          shortExecutor,
          [proposalExecutionPayload],
          ['0'],
          [executeSignature],
          [callData],
          [true],
          ipfsEncoded,
          { gasLimit: 3000000 }
        );
        console.log('- Proposal submitted to Governance');
        await tx.wait();
      } catch (error) {
        logError();
        throw error;
      }

      console.log('Your Proposal has been submitted');
    }
  );
