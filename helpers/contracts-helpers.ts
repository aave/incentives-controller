import { Contract, Signer, utils, ethers, BigNumberish } from 'ethers';
import { signTypedData_v4 } from 'eth-sig-util';
import { fromRpcSig, ECDSASignature } from 'ethereumjs-util';
import { getDb, DRE, waitForTx } from './misc-utils';
import {
  tEthereumAddress,
  eContractid,
  eEthereumNetwork,
  iParamsPerNetwork,
  ePolygonNetwork,
  eXDaiNetwork,
  eNetwork,
  iEthereumParamsPerNetwork,
  iPolygonParamsPerNetwork,
  iXDaiParamsPerNetwork,
} from './types';
import { Artifact } from 'hardhat/types';
import { verifyContract } from './etherscan-verification';
import { usingTenderly } from './tenderly-utils';

export const registerContractInJsonDb = async (contractId: string, contractInstance: Contract) => {
  const currentNetwork = DRE.network.name;
  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  if (MAINNET_FORK || (currentNetwork !== 'hardhat' && !currentNetwork.includes('coverage'))) {
    console.log(`*** ${contractId} ***\n`);
    console.log(`Network: ${currentNetwork}`);
    console.log(`tx: ${contractInstance.deployTransaction.hash}`);
    console.log(`contract address: ${contractInstance.address}`);
    console.log(`deployer address: ${contractInstance.deployTransaction.from}`);
    console.log(`gas price: ${contractInstance.deployTransaction.gasPrice}`);
    console.log(`gas used: ${contractInstance.deployTransaction.gasLimit}`);
    console.log(`\n******`);
    console.log();
  }

  await getDb()
    .set(`${contractId}.${currentNetwork}`, {
      address: contractInstance.address,
      deployer: contractInstance.deployTransaction.from,
    })
    .write();
};
export const getFirstSigner = async () => (await DRE.ethers.getSigners())[0];

export const insertContractAddressInDb = async (id: eContractid, address: tEthereumAddress) =>
  await getDb()
    .set(`${id}.${DRE.network.name}`, {
      address,
    })
    .write();

export const rawInsertContractAddressInDb = async (id: string, address: tEthereumAddress) =>
  await getDb()
    .set(`${id}.${DRE.network.name}`, {
      address,
    })
    .write();

export const getEthersSigners = async (): Promise<Signer[]> =>
  await Promise.all(await DRE.ethers.getSigners());

export const getEthersSignersAddresses = async (): Promise<tEthereumAddress[]> =>
  await Promise.all((await DRE.ethers.getSigners()).map((signer) => signer.getAddress()));

export const getCurrentBlock = async () => {
  return DRE.ethers.provider.getBlockNumber();
};

export const decodeAbiNumber = (data: string): number =>
  parseInt(utils.defaultAbiCoder.decode(['uint256'], data).toString());

export const deployContract = async <ContractType extends Contract>(
  contractName: string,
  args: any[]
): Promise<ContractType> => {
  const contract = (await (await DRE.ethers.getContractFactory(contractName)).deploy(
    ...args
  )) as ContractType;
  await waitForTx(contract.deployTransaction);
  await registerContractInJsonDb(<eContractid>contractName, contract);
  return contract;
};

export const withSaveAndVerify = async <ContractType extends Contract>(
  instance: ContractType,
  id: string,
  args: (string | string[])[],
  verify?: boolean
): Promise<ContractType> => {
  await waitForTx(instance.deployTransaction);
  await registerContractInJsonDb(id, instance);
  if (usingTenderly()) {
    console.log();
    console.log('Doing Tenderly contract verification of', id);
    await (DRE as any).tenderlyRPC.verify({
      name: id,
      address: instance.address,
    });
    console.log(`Verified ${id} at Tenderly!`);
    console.log();
  }
  if (verify) {
    await verifyContract(instance.address, args);
  }
  return instance;
};

export const getContract = async <ContractType extends Contract>(
  contractName: string,
  address: string
): Promise<ContractType> => (await DRE.ethers.getContractAt(contractName, address)) as ContractType;

export const linkBytecode = (artifact: Artifact, libraries: any) => {
  let bytecode = artifact.bytecode;

  for (const [fileName, fileReferences] of Object.entries(artifact.linkReferences)) {
    for (const [libName, fixups] of Object.entries(fileReferences)) {
      const addr = libraries[libName];

      if (addr === undefined) {
        continue;
      }

      for (const fixup of fixups) {
        bytecode =
          bytecode.substr(0, 2 + fixup.start * 2) +
          addr.substr(2) +
          bytecode.substr(2 + (fixup.start + fixup.length) * 2);
      }
    }
  }

  return bytecode;
};

export const getParamPerNetwork = <T>(param: iParamsPerNetwork<T>, network: eNetwork) => {
  const {
    main,
    ropsten,
    kovan,
    coverage,
    buidlerevm,
    tenderlyMain,
  } = param as iEthereumParamsPerNetwork<T>;
  const { matic, mumbai } = param as iPolygonParamsPerNetwork<T>;
  const { xdai } = param as iXDaiParamsPerNetwork<T>;
  const MAINNET_FORK = process.env.MAINNET_FORK === 'true';
  if (MAINNET_FORK) {
    return main;
  }

  switch (network) {
    case eEthereumNetwork.coverage:
      return coverage;
    case eEthereumNetwork.buidlerevm:
      return buidlerevm;
    case eEthereumNetwork.hardhat:
      return buidlerevm;
    case eEthereumNetwork.kovan:
      return kovan;
    case eEthereumNetwork.ropsten:
      return ropsten;
    case eEthereumNetwork.main:
      return main;
    case eEthereumNetwork.tenderlyMain:
      return tenderlyMain;
    case ePolygonNetwork.matic:
      return matic;
    case ePolygonNetwork.mumbai:
      return mumbai;
    case eXDaiNetwork.xdai:
      return xdai;
  }
};

export const getSignatureFromTypedData = (
  privateKey: string,
  typedData: any // TODO: should be TypedData, from eth-sig-utils, but TS doesn't accept it
): ECDSASignature => {
  const signature = signTypedData_v4(Buffer.from(privateKey.substring(2, 66), 'hex'), {
    data: typedData,
  });
  return fromRpcSig(signature);
};

type ContractGetter = { address?: string; slug?: string };
export const getContractFactory = <ContractType extends Contract>(
  contractName: eContractid
) => async (contractGetter?: ContractGetter): Promise<ContractType> => {
  let deployedContract = '';
  if (!contractGetter?.address) {
    try {
      deployedContract = (
        await getDb()
          .get(
            `${contractName}${contractGetter?.slug ? `-${contractGetter.slug}` : ''}.${
              DRE.network.name
            }`
          )
          .value()
      ).address;
    } catch (e) {
      throw new Error(
        `Contract ${contractName} was not deployed on ${DRE.network.name} or not stored in DB`
      );
    }
  }
  return (await DRE.ethers.getContractAt(
    contractName,
    contractGetter?.address || deployedContract
  )) as ContractType;
};

export const getBlockTimestamp = async (blockNumber?: number): Promise<number> => {
  if (!blockNumber) {
    blockNumber = await getCurrentBlock();
  }
  const block = await DRE.ethers.provider.getBlock(blockNumber);
  return block.timestamp;
};
