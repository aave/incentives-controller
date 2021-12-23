import { isAddress } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { ZERO_ADDRESS } from '../../helpers/constants';
import {
  deployPullRewardsIncentivesController,
  deployInitializableAdminUpgradeabilityProxy,
} from '../../helpers/contracts-accessors';
import { getFirstSigner } from '../../helpers/contracts-helpers';
import { waitForTx } from '../../helpers/misc-utils';
import { BaseAdminUpgradeabilityProxy__factory, PullRewardsIncentivesController__factory } from '../../types';

const assetConfigs = {
  WNEAR: {
    aToken: '0x6b16bC535fa5bD71ed953929302Da7125eEFF9D1',
    vToken: '0xB01D2667B8f6a801607EeA7EFcDa82B7E485BF7e',
    aTokenEPS: '48225308641975300',
    vTokenEPS: '1929012345679010'
  },
  WETH: {
    aToken: '0xE43B41D52CA53Cd64aF5a279F8D87060587B2464',
    vToken: '0x439615274EFB1354B7cb95d5ff790596Df825634',
    aTokenEPS: '27488425925925900',
    vTokenEPS: '3858024691358030'
  },
  USDC: {
    aToken: '0x01411D50dCF1d6D052A302028c635044d37bb96A',
    vToken: '0x24e97e8d01e371419a2891bE3D637C24b7A0908F',
    aTokenEPS: '25077160493827200',
    vTokenEPS: '19290123456790100'
  },
  USDT: {
    aToken: '0x392eEA56d8B504A7B4373EDBD36107D82BeaE6C4',
    vToken: '0xf7Cc5e449AB8Ce31f6C5ee51b3935176931DcA50',
    aTokenEPS: '9645061728395060',
    vTokenEPS: '10609567901234600'
  },
  DAI: {
    aToken: '0x4B7dD90835Bf67CF94aa728fC8e9786De6717E95',
    vToken: '0x6101314e4f146c989CC53A443f339443083AF007',
    aTokenEPS: '23148148148148100',
    vTokenEPS: '19290123456790100'
  },
  WBTC: {
    aToken: '0x106F48Cbd1a851Fe0762b7315691308E8163ba86',
    vToken: '0x0E0dCfAcE97FbbAfca6570E2769950363CB90D40',
    aTokenEPS: '3858024691358030',
    vTokenEPS: '482253086419753'
  },
};

task(
  `config-assets`,
  `Config the PullRewardsIncentivesController contract`
)
  .addParam('proxy')
  .setAction(
    async ({ proxy }, localBRE) => {
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
          aTokenEPS,
          vTokenEPS
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
