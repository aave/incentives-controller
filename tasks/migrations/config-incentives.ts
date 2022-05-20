  import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

  const assetConfigs = {
    WNEAR: {
      aToken: '0x97835f45F95CbBacDb54a5340c43309214cC7907',
      vToken: '0x3AA930B2b7a7d9E5C77135b732f638f2A7a0196F',
      aTokenEPS: ['964506172839506000000', '964506172839506000000'],
      vTokenEPS: ['96450617283950600000', '96450617283950600000']
    },
    LINEAR: {
      aToken: '0xD221Dbf79790b482aB8DDa7a303ACB077f477a9B',
      vToken: '0x2654A544A914A23b93eE5C55cd05FDC9ecAA5b0E',
      aTokenEPS: ['964506172839506000000', '964506172839506000000'],
      vTokenEPS: ['96450617283950600000', '96450617283950600000']
    },
    WETH: {
      aToken: '0xC82431482f1770cB0565d0eA6FF6c86b62A61899',
      vToken: '0x6Bb69467531220464c3609a2ee88Ee08f071F235',
      aTokenEPS: ['1446759259259260000000', '1446759259259260000000'],
      vTokenEPS: ['192901234567901000000', '192901234567901000000']
    },
    USDC: {
      aToken: '0xfEFED8eE9D926770C34232AA6434E10C28871EFA',
      vToken: '0x8b08Cf5Fb1869De3704379f2BfF42666690016bC',
      aTokenEPS: ['1446759259259260000000', '1446759259259260000000'],
      vTokenEPS: ['964506172839506000000', '964506172839506000000']
    },
    USDT: {
      aToken: '0x117aAfdfbF8691d4d5CE10A5F92332f51811758C',
      vToken: '0x4f097a9ed8ca2D6981F84104b315163D2e5447eB',
      aTokenEPS: ['771604938271605000000', '771604938271605000000'],
      vTokenEPS: ['482253086419753000000', '482253086419753000000']
    },
    DAI: {
      aToken: '0x2684D06f068CB19FadcB279786c85f3310e74560',
      vToken: '0x0c34F0C5dc391517bD06B2772b98Ad6ECcf8848a',
      aTokenEPS: ['482253086419753000000', '482253086419753000000'],
      vTokenEPS: ['482253086419753000000', '482253086419753000000']
    },
    WBTC: {
      aToken: '0x9C6DC42a471Fa4273B797d84Fa56355d2Af7cAC8',
      vToken: '0x2fb392Ff2FbbF018759625Cd6ef512d7BF752eDB',
      aTokenEPS: ['241126543209877000000', '241126543209877000000'],
      vTokenEPS: ['48225308641975300000', '48225308641975300000']
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
