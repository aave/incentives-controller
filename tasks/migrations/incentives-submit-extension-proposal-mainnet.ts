import { formatEther } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { DRE, impersonateAccountsHardhat, latestBlock } from '../../helpers/misc-utils';
import { IERC20__factory, IGovernancePowerDelegationToken__factory } from '../../types';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import isIPFS from 'is-ipfs';
import { Signer } from '@ethersproject/abstract-signer';

const {
  AAVE_TOKEN = '0x4da27a545c0c5b758a6ba100e3a049001de870f5',
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c', // mainnet
  AAVE_SHORT_EXECUTOR = '0xee56e2b3d491590b5b31738cc34d5232f378a8d5', // mainnet
} = process.env;

task(
  'incentives-submit-extension-proposal:mainnet',
  'Submit the incentives proposal to Aave Governance'
)
  .addFlag('defender')
  .setAction(async ({ defender }, localBRE) => {
    await localBRE.run('set-DRE');
    let proposer: Signer;
    [proposer] = await DRE.ethers.getSigners();


    if (defender) {
      const { signer } = await getDefenderRelaySigner();
      proposer = signer;
    }

    const proposalExecutionPayload = "0x2FcdE9dD21e32005836E195BeE8D8c973E272289";

    if (!AAVE_TOKEN || !AAVE_GOVERNANCE_V2 || !AAVE_SHORT_EXECUTOR) {
      throw new Error('You have not set correctly the .env file, make sure to read the README.md');
    }

    const proposerAddress = await proposer.getAddress();

    // Initialize contracts and tokens
    const gov = (await DRE.ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      proposer
    )) as IAaveGovernanceV2;

    const aave = IERC20__factory.connect(AAVE_TOKEN, proposer);

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
      aaveGovernance: AAVE_GOVERNANCE_V2,
      shortExecutor: AAVE_SHORT_EXECUTOR,
      defender: true,
    };
    console.log('- Submitting proposal with following params:');
    console.log(JSON.stringify(proposalParams, null, 2));

    const executeSignature = 'execute()';
    const ipfsEncoded = '0xe7e93497d3847536f07fe8dba53485cf68a275c7b07ca38b53d2cc2d43fab3b0';
    try {
      const tx = await gov.create(
        AAVE_SHORT_EXECUTOR,
        [proposalExecutionPayload],
        ['0'],
        [executeSignature],
        ['0x'],
        [true],
        ipfsEncoded,
        { gasLimit: 3000000 }
      );
      console.log('- Proposal submitted to Governance');
      await tx.wait();
    } catch (error) {
      throw error;
    }

    console.log('- Proposal Submited:', proposalId.toString());
  });
