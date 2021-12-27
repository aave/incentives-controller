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
    aToken: '0x55099726bFEE54A94314d4fC150736104DFc7e3D',
    vToken: '0xB87Bff111ad54299af84b69b1D02eC053141Da97',
    aTokenEPS: '48225308641975300',
    vTokenEPS: '1929012345679010'
  },
  WETH: {
    aToken: '0x8EfF18FC088b1A157440E4e29742FD25E186A3F7',
    vToken: '0x99E6A89Ce73696b38189bF0a89087f700eb4B537',
    aTokenEPS: '27488425925925900',
    vTokenEPS: '3858024691358030'
  },
  USDC: {
    aToken: '0xDE98b96ab74D3f242b045E3FAF28536548A65BE1',
    vToken: '0x6F22C0C4f77C75868845c7C4B7568F2bbB7d452d',
    aTokenEPS: '25077160493827200',
    vTokenEPS: '19290123456790100'
  },
  USDT: {
    aToken: '0x63bccafA87d7416eB4f3CA3cAE857fCF79d158Ae',
    vToken: '0x1B8b38c079978E871f689aCb539436A32790F332',
    aTokenEPS: '9645061728395060',
    vTokenEPS: '10609567901234600'
  },
  DAI: {
    aToken: '0xa0692D6da399aDD8949F4931f78C62AB76380D07',
    vToken: '0xF4fF8BDaE5BdaF7763cdb6cF84cD54dDf1e6b1FD',
    aTokenEPS: '23148148148148100',
    vTokenEPS: '19290123456790100'
  },
  WBTC: {
    aToken: '0x870fA576Bc30230646cDF6e6778cE7249349a2ED',
    vToken: '0x4ff264D429C8a5535D6ef8b35f83fB20b729a4DB',
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
