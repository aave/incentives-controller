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
    aToken: '0x2787D0ba69D2D428e51A60cBa627557F956a920d',
    vToken: '0xfE74931D7127BcdA7c82c1890B84DBBf2598a955',
    aTokenEPS: '964506172839506000000',
    vTokenEPS: '96450617283950600000'
  },
  LINEAR: {
    aToken: '0xF35bcdf84477058d84eb2a5d9DfD9b438E05DB50',
    vToken: '0xDa6df7Fa82AD353C05099fEe380B6797B37d44dD',
    aTokenEPS: '964506172839506000000',
    vTokenEPS: '96450617283950600000'
  },
  WETH: {
    aToken: '0xcCbf0fA8cC796CAC3EA16a4f09bf818Fef07dB5C',
    vToken: '0x6057F7AA1BF1C9eaB0d992e14639b5A171e99a79',
    aTokenEPS: '1446759259259260000000',
    vTokenEPS: '192901234567901000000'
  },
  USDC: {
    aToken: '0x4c3F0cF4f3AF7107CBf362487BB0d9733D4417D8',
    vToken: '0x4da131437EA89C0DA466303fdB24496A680E82cE',
    aTokenEPS: '1446759259259260000000',
    vTokenEPS: '964506172839506000000'
  },
  USDT: {
    aToken: '0x18e2A17c8Ed165feEE3738207cfc0387b9EDcd80',
    vToken: '0x69589c7289be77a4E178f25C1d4fc80a1857AD81',
    aTokenEPS: '771604938271605000000',
    vTokenEPS: '482253086419753000000'
  },
  DAI: {
    aToken: '0x4B05a70434954249aEEF9d94924D5711A130d580',
    vToken: '0xa3E664ace5555577865Df8ad9321642F955Be2d0',
    aTokenEPS: '482253086419753000000',
    vTokenEPS: '482253086419753000000'
  },
  WBTC: {
    aToken: '0x6d00022AA07fF78Cd17e88cAA4586C8d7f88AE2D',
    vToken: '0x933Cc011e12eb29e7BCBD455419F9f5fF8b34dFE',
    aTokenEPS: '241126543209877000000',
    vTokenEPS: '48225308641975300000'
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
