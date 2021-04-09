import { task } from 'hardhat/config';
import { config } from 'dotenv';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { ProposalIncentivesExecutorFactory } from '../../types';
import { ZERO_ADDRESS } from '../../helpers/constants';
import { IAaveGovernanceV2Factory } from '../../types/IAaveGovernanceV2Factory';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const bs58 = require('bs58');

config();

task('propose-incentives', 'Create some proposals and votes')
  .addParam('proposalExecutionPayload')
  .addParam('incentivesProxy')
  .addParam('aTokens')
  .addParam('variableDebtTokens')
  .addParam('aaveGovernance')
  .addParam('shortExecutor')
  .addParam('ipfsHash')
  .setAction(
    async (
      {
        incentivesProxy,
        aTokens,
        variableDebtTokens,
        aaveGovernance,
        shortExecutor,
        ipfsHash,
        proposalExecutionPayload,
      },
      _DRE: any
    ) => {
      const proposer = (await _DRE.ethers.getSigners())[0];

      aTokens = aTokens.split(',');
      variableDebtTokens = variableDebtTokens.split(',');

      const callData = _DRE.ethers.utils.defaultAbiCoder.encode(
        ['address', 'address[6]', 'address[6]'],
        [incentivesProxy, aTokens, variableDebtTokens]
      );

      const executeSignature = 'execute(address,address[6],address[6])';
      // const executeSignature = 'execute()';
      const gov = await IAaveGovernanceV2Factory.connect(aaveGovernance, proposer);
      const ipfsEncoded = `0x${bs58.decode(ipfsHash).slice(2).toString('hex')}`;

      await (
        await gov.create(
          shortExecutor,
          [proposalExecutionPayload],
          ['0'],
          [executeSignature],
          [callData],
          [true],
          ipfsEncoded
        )
      ).wait();
      console.log('Your Proposal has been submitted');
    }
  );
