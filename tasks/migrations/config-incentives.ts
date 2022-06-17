  import { task } from 'hardhat/config';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { PullRewardsIncentivesController__factory } from '../../types';

  const assetConfigs = {
    WNEAR: {
      aToken: '0xFfde687Dce1E2EC0356308bFedD80a4259D95cD0',
      vToken: '0x173F4923e74Bd9efb24Ae22D7038aaeCa940F6Fb',
      aTokenEPS: ['964506172839506000000', '964506172839506000000'],
      vTokenEPS: ['96450617283950600000', '96450617283950600000']
    },
    LINEAR: {
      aToken: '0x173F4923e74Bd9efb24Ae22D7038aaeCa940F6Fb',
      vToken: '0x55F58bA8020275125C24cdA50E22Bd2d6BBcf0D5',
      aTokenEPS: ['964506172839506000000', '964506172839506000000'],
      vTokenEPS: ['96450617283950600000', '96450617283950600000']
    },
    WETH: {
      aToken: '0x55F58bA8020275125C24cdA50E22Bd2d6BBcf0D5',
      vToken: '0xC2ff7D85E4Ecd4AA55C296Fb1AfeEf6F9e012e26',
      aTokenEPS: ['1446759259259260000000', '1446759259259260000000'],
      vTokenEPS: ['192901234567901000000', '192901234567901000000']
    },
    USDC: {
      aToken: '0xC2ff7D85E4Ecd4AA55C296Fb1AfeEf6F9e012e26',
      vToken: '0x2EC5Dd6A63C8815C4a947A55e2F6c37B2CDAc398',
      aTokenEPS: ['1446759259259260000000', '1446759259259260000000'],
      vTokenEPS: ['964506172839506000000', '964506172839506000000']
    },
    USDT: {
      aToken: '0x2EC5Dd6A63C8815C4a947A55e2F6c37B2CDAc398',
      vToken: '0xb006BC50BB4069f5C8cD0488E1f983344f78F099',
      aTokenEPS: ['771604938271605000000', '771604938271605000000'],
      vTokenEPS: ['482253086419753000000', '482253086419753000000']
    },
    DAI: {
      aToken: '0xdF320Fa4F7011bb2B98f2fd2444642e21c322147',
      vToken: '0x860127601DFC25753233d04E4d221F4BB9062324',
      aTokenEPS: ['482253086419753000000', '482253086419753000000'],
      vTokenEPS: ['482253086419753000000', '482253086419753000000']
    },
    WBTC: {
      aToken: '0x126A1616dEBdFF6D49c22a5698b3a0ca49304be1',
      vToken: '0xAD555b68c79e16ece60cCfbc15fc19A0FfBf8509',
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
