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
    aToken: '0xaF460F8c94D45CB7b1249D1909Effc1E275114E3',
    vToken: '0x394b0E8B0bcAe225Ae1477ff685B24322e0A24b4',
    aTokenEPS: '48225308641975300',
    vTokenEPS: '1929012345679010'
  },
  WETH: {
    aToken: '0xcC7b2d816C4025063824c21D99a6D39B986feDaD',
    vToken: '0x0F7760c8FC38Cfa8622f97E89c1f78AA0eeA3602',
    aTokenEPS: '27488425925925900',
    vTokenEPS: '3858024691358030'
  },
  USDC: {
    aToken: '0x897a6cfcd6d6747524d1aB5c2682072942b4d1CF',
    vToken: '0x50e65b09F2D91F081dfAb452d470288676509fEB',
    aTokenEPS: '25077160493827200',
    vTokenEPS: '19290123456790100'
  },
  USDT: {
    aToken: '0x8d77C7E8a68998f764F23c7D2F0EEc9A09E300F9',
    vToken: '0xa83A0e05dA56218310f9c81b51C9115bd3885892',
    aTokenEPS: '9645061728395060',
    vTokenEPS: '10609567901234600'
  },
  DAI: {
    aToken: '0xcFE666449D295F85F89758f87BCDF310a6c8fEb7',
    vToken: '0x6FfCdc328750529D862767A3258F83E4e0Cbc96F',
    aTokenEPS: '23148148148148100',
    vTokenEPS: '19290123456790100'
  },
  WBTC: {
    aToken: '0xD42d61277eCb87C1A3d1A308b58Aa3eDAc091cb2',
    vToken: '0xb083b0C7aDd999e4C8674Ec992991FD8Ee3151DC',
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
