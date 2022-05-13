// @ts-ignore
import {
  eAuroraNetwork,
  eAvalancheNetwork,
  eEthereumNetwork,
  ePolygonNetwork,
  eXDaiNetwork,
  iParamsPerNetwork,
} from './helpers/types';

require('dotenv').config();

const INFURA_KEY = process.env.INFURA_KEY || '';
const ALCHEMY_KEY = process.env.ALCHEMY_KEY || '';
const TENDERLY_FORK_ID = process.env.TENDERLY_FORK_ID || '';

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.kovan]: ALCHEMY_KEY
    ? `https://eth-kovan.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://kovan.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.ropsten]: ALCHEMY_KEY
    ? `https://eth-ropsten.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://ropsten.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.main]: ALCHEMY_KEY
    ? `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_KEY}`
    : `https://mainnet.infura.io/v3/${INFURA_KEY}`,
  [eEthereumNetwork.coverage]: 'http://localhost:8555',
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.buidlerevm]: 'http://localhost:8545',
  [eEthereumNetwork.tenderlyMain]: `https://rpc.tenderly.co/fork/${TENDERLY_FORK_ID}`,
  [ePolygonNetwork.mumbai]: 'https://rpc-mumbai.maticvigil.com',
  [ePolygonNetwork.matic]: 'https://rpc-mainnet.matic.network',
  [eXDaiNetwork.xdai]: 'https://rpc.xdaichain.com/',
  [eAvalancheNetwork.avalanche]: 'https://cchain.explorer.avax.network/',
  [eAvalancheNetwork.fuji]: 'https://api.avax-test.network/ext/bc/C/rpc',
  [eAuroraNetwork.aurora]: 'https://mainnet.aurora.dev/5eZVevhGw6jT8N8nuXZF14NzfWPibWozE2oNa6Phpbio'
  // [eAuroraNetwork.aurora]: 'http://159.223.90.123:8545',
};

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.kovan]: 1 * GWEI,
  [eEthereumNetwork.ropsten]: 1 * GWEI,
  [eEthereumNetwork.main]: 180 * GWEI,
  [eEthereumNetwork.coverage]: 1 * GWEI,
  [eEthereumNetwork.hardhat]: 1 * GWEI,
  [eEthereumNetwork.buidlerevm]: 1 * GWEI,
  [eEthereumNetwork.tenderlyMain]: 1 * GWEI,
  [ePolygonNetwork.mumbai]: 1 * GWEI,
  [ePolygonNetwork.matic]: 2 * GWEI,
  [eXDaiNetwork.xdai]: 1 * GWEI,
  [eAuroraNetwork.aurora]: 0 * GWEI,
  [eAvalancheNetwork.fuji]: 225 * GWEI,
  [eAvalancheNetwork.avalanche]: 225 * GWEI,
};
