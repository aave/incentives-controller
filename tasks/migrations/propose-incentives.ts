import { task } from 'hardhat/config';
import { config } from 'dotenv';
import { IAaveGovernanceV2Factory } from '../../types/IAaveGovernanceV2Factory';
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
  .setAction(
    async (
      {
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
        ['address[6]', 'address[6]'],
        [aTokens, variableDebtTokens]
      );

      const executeSignature = 'execute(address[6],address[6])';
      const gov = await IAaveGovernanceV2Factory.connect(aaveGovernance, proposer);
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
        if (_DRE.network.name.includes('tenderly')) {
          const transactionLink = `https://dashboard.tenderly.co/${_DRE.config.tenderly.username}/${
            _DRE.config.tenderly.project
          }/fork/${_DRE.tenderly
            .network()
            .getFork()}/simulation/${_DRE.tenderly.network().getHead()}`;
          console.error(
            '[TENDERLY] Transaction Reverted. Check TX simulation error at:',
            transactionLink
          );
        }
        throw error;
      }

      console.log('Your Proposal has been submitted');
    }
  );
