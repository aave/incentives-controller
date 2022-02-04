[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build pass](https://github.com/aave/incentives-controller/actions/workflows/node.js.yml/badge.svg)](https://github.com/aave/incentives-controller/actions/workflows/node.js.yml)
[![codecov](https://codecov.io/gh/aave/incentives-controller/branch/master/graph/badge.svg?token=DRFNLw506C)](https://codecov.io/gh/aave/incentives-controller)

# Aave incentives

## Introduction

This repo contains the code and implementation of the contracts used to activate the liquidity mining program on the main market of the Aave protocol.

## Implementation

The rewards are distributed in the form of stkAAVE, which is obtained by staking Aave in the Safety Module Staking contract located at https://etherscan.io/address/0x4da27a545c0c5b758a6ba100e3a049001de870f5.

The incentives controller contract, `StakedTokenIncentivesController`, stakes the rewards while transferring the obtained stkAAVE to the claiming user.

The implementation logic is defined as follow:

- Each asset has a defined `emissionPerSecond`
- For each asset, an `assetIndex` keeps track of the total accumulated rewards
- For each user, a `userIndex` keeps track of the user accumulated rewards
- On `handleAction()`, that is triggered whenever an aToken/debt Token is minted/burned by a user, the `userIndex` and the `assetIndex` are accumulated depending on the time passed since the last action
- At any point in time the user pending rewards can be queried through the `getRewardsBalance()` function

## About Development

### Setup

create `.env` file like

```bash
# Mnemonic, only first address will be used
MNEMONIC=""

# Add Alchemy or Infura provider keys, alchemy takes preference at the config level
ALCHEMY_KEY=""
INFURA_KEY=""
BWARE_LABS_KEY=""

# Optional Etherscan key, for automatize the verification of the contracts at Etherscan
ETHERSCAN_KEY=""

# Optional, if you plan to use Tenderly scripts
TENDERLY_PROJECT=""
TENDERLY_USERNAME=""

# defender Relay
DEFENDER_API_KEY=""
DEFENDER_SECRET_KEY=""
```

### Deploy

```bash
npm install
npm run compile
docker-compose up
# --- other terminal ---
docker-compose exec contracts-env bash
npm run deploy:incentives-controller-impl:shibuya
```
