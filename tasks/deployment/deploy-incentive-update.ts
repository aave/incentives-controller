import { Signer } from "ethers";
import { task } from "hardhat/config";
import { verifyContract } from "../../helpers/etherscan-verification";
import { sleep } from "../../helpers/misc-utils";
import { IncentiveUpdateExecutor__factory } from "../../types";

task('deploy-incentive-update').setAction(
  async (_, localBRE) => {
    _;
    await localBRE.run('set-DRE');

    let deployer: Signer;
    [deployer] = await localBRE.ethers.getSigners();

    const { address } = await new IncentiveUpdateExecutor__factory(deployer).deploy();

    await sleep(30000);

    await verifyContract(address, []);
  }
);