  import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

  const assetConfigs = {
    WNEAR: {
      aToken: '0x6E20AE9deE86D03671668C92Dcc6230B10d67A1e',
      vToken: '0xb6eF9802662577C5Cf8B0dA3141cFE4bE99b6C34',
      aTokenEPS: ['964506172839506000000', '23148148148148200000000'],
      vTokenEPS: ['96450617283950600000', '34722222222222200000000']
    },
    LINEAR: {
      aToken: '0xC6561951A1592A001265B46e3c65b715cc61218D',
      vToken: '0x7ABc9ec773582D19421Dd13F195282E27209ABD0',
      aTokenEPS: ['1929012345679010000000', '28935185185185200000000'],
      vTokenEPS: ['96450617283950600000', '17361111111111100000000']
    },
    WETH: {
      aToken: '0x44840c7a7d5Fa806bE2429F42F3C683FAfdCa7ff',
      vToken: '0x1db13f2465389f4d340eCEb0351e957202187381',
      aTokenEPS: ['1446759259259260000000', '11574074074074100000000'],
      vTokenEPS: ['192901234567901000000', '11574074074074100000000']
    },
    USDC: {
      aToken: '0xde49F8aD111e2dc2f6541d4179b3133F1a80606f',
      vToken: '0x7985f7013A8F6CdbBD86EBfaaeEd8641D12370D5',
      aTokenEPS: ['1446759259259260000000', '17361111111111100000000'],
      vTokenEPS: ['964506172839506000000', '17361111111111100000000']
    },
    USDT: {
      aToken: '0x7200913df61AF931Dfcf906aEF0750E975182505',
      vToken: '0xf4aE20388D1988615523015941A22D5D21A5C25F',
      aTokenEPS: ['771604938271605000000', '17361111111111100000000'],
      vTokenEPS: ['482253086419753000000', '17361111111111100000000']
    },
    DAI: {
      aToken: '0xd85E6F93Ea0feA6ee0d8Afe2c03645b723e7e6EA',
      vToken: '0x19E3465646FC5f9F18158B30e90a5cf0167ea758',
      aTokenEPS: ['482253086419753000000', '11574074074074100000000'],
      vTokenEPS: ['482253086419753000000', '11574074074074100000000']
    },
    WBTC: {
      aToken: '0xAd0EC8806224337A4ce906bA203B6344c15e6def',
      vToken: '0xaee214895cbc9eab00024DDE06f86E7440E93a91',
      aTokenEPS: ['241126543209877000000', '5787037037037000000000'],
      vTokenEPS: ['48225308641975300000', '5787037037037000000000']
    },
  };

  task(
    `config-assets`,
    `Config the PullRewardsIncentivesController contract`
  )
    .addParam('proxy')
    .addParam('index')
    .setAction(
      async ({ proxy, index }, localBRE) => {
        await localBRE.run('set-DRE');
        const deployer = await getFirstSigner();

        const incentivesProxy = PullRewardsIncentivesController__factory
          .connect(proxy, deployer);

        // config assets
        for (const assetSymbol of Object.keys(assetConfigs)) {
          const config = assetConfigs[assetSymbol];
          const { aToken, vToken, aTokenEPS, vTokenEPS } = config;

          const assets = [
            aToken,
            vToken
          ];
          const assetsEps = [
            aTokenEPS[index],
            vTokenEPS[index]
          ];
          await waitForTx(
            await incentivesProxy.configureAssets(
              assets,
              assetsEps
            )
          );

          console.log(`${assetSymbol} configured.`)
        }

        const distributionEnd = Math.floor(Date.now() / 1000) + (60 * 24 * 3600); // 2 months from now
        await waitForTx(
          await incentivesProxy.setDistributionEnd(distributionEnd)
        );
        console.log(`Distribution end set to ${distributionEnd}`);
      }
    );
