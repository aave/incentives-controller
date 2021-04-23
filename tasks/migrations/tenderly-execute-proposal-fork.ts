import { formatEther, parseEther } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/dist/src/signer-with-address';
import { JsonRpcSigner } from '@ethersproject/providers';
import { task } from 'hardhat/config';
import { DRE, advanceBlockTo, latestBlock, increaseTime } from '../../helpers/misc-utils';
import { tEthereumAddress } from '../../helpers/types';
import { IERC20__factory, IGovernancePowerDelegationToken__factory } from '../../types';
import { IAaveGovernanceV2 } from '../../types/IAaveGovernanceV2';
import { logError } from '../../helpers/tenderly-utils';
import { getDefenderRelaySigner } from '../../helpers/defender-utils';
import { Signer } from 'ethers';

const {
  AAVE_TOKEN = '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  AAVE_GOVERNANCE_V2 = '0xEC568fffba86c094cf06b22134B23074DFE2252c',
} = process.env;

const VOTING_DURATION = 18200;

const AAVE_WHALE = '0x25f2226b597e8f9514b3f68f00f494cf4f286491';

const INCENTIVES_PROXY = '0xd784927Ff2f95ba542BfC824c8a8a98F3495f6b5';

task('execute-proposal:tenderly', 'Spin a tenderly fork with incentives activated')
  .addParam('proposalId')
  .setAction(async ({ proposalId }, localBRE) => {
    let ethers;
    let whale: JsonRpcSigner;
    let proposer: Signer;
    let gov: IAaveGovernanceV2;

    await localBRE.run('set-DRE');

    if (!localBRE.network.name.includes('tenderly')) {
      console.error('You must connect to tenderly via --network tenderly to use this task.');
      throw Error('tenderly-network-missing');
    }

    const [signer] = await DRE.ethers.getSigners();

    proposer = signer;

    const proposerAddress = await proposer.getAddress();

    ethers = DRE.ethers;

    // Impersonating holders
    whale = ethers.provider.getSigner(AAVE_WHALE);

    // Initialize contracts and tokens
    gov = (await ethers.getContractAt(
      'IAaveGovernanceV2',
      AAVE_GOVERNANCE_V2,
      whale
    )) as IAaveGovernanceV2;

    // Mine block due flash loan voting protection
    await advanceBlockTo((await latestBlock()) + 100);

    // Submit vote and advance block to Queue phase
    await (await gov.submitVote(proposalId, true)).wait();

    await advanceBlockTo((await latestBlock()) + VOTING_DURATION + 1);

    try {
      // Queue and advance block to Execution phase
      await (await gov.queue(proposalId, { gasLimit: 3000000 })).wait();
    } catch (error) {
      logError();
      throw error;
    }

    await increaseTime(86400 + 10);

    // Execute payload
    await (await gov.execute(proposalId)).wait();
    console.log('Proposal executed');
  });
