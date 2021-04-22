import { task } from 'hardhat/config';
import { config } from 'dotenv';
import { IAaveGovernanceV2__factory } from '../../types';
import { Signer } from 'ethers';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { DRE } from '../../helpers/misc-utils';
import { logError } from '../../helpers/tenderly-utils';
import isIPFS from 'is-ipfs';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const bs58 = require('bs58');

config();

task('propose-incentives', 'Create some proposals and votes')
  .addParam('proposalExecutionPayload')
  .addParam('aTokens')
  .addParam('variableDebtTokens')
  .addParam('aaveGovernance')
  .addParam('shortExecutor')
  .addParam('ipfsHash')
  .addFlag('defender')
  .setAction(
    async (
      {
        aTokens,
        variableDebtTokens,
        aaveGovernance,
        shortExecutor,
        ipfsHash,
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

      if (!isIPFS.multihash(ipfsHash)) {
        console.log('Please check IPFS_HASH env variable due is not valid ipfs multihash.');
        throw Error('IPFS_HASH is not valid');
      }

      aTokens = aTokens.split(',');
      variableDebtTokens = variableDebtTokens.split(',');

      const callData = DRE.ethers.utils.defaultAbiCoder.encode(
        ['address[6]', 'address[6]'],
        [aTokens, variableDebtTokens]
      );

      const executeSignature = 'execute(address[6],address[6])';
      const gov = await IAaveGovernanceV2__factory.connect(aaveGovernance, proposer);
      const ipfsEncoded = `0x${bs58.decode(ipfsHash).slice(2).toString('hex')}`;

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
