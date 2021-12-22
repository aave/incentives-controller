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
    aToken: '0xACAC42e099180F37b061304947CD0EE0c8697e5d',
    vToken: '0xb4640F4bC6f5d28961a2b82C557A09C7A32F5edB',
    aTokenEPS: '48225308641975300',
    vTokenEPS: '1929012345679010'
  },
  WETH: {
    aToken: '0x13eC81353507888D0b24776D60F59DB6eC12D81B',
    vToken: '0xE45Ad35E9B83da835b0CEe639ff34fe13b23Aa72',
    aTokenEPS: '27488425925925900',
    vTokenEPS: '3858024691358030'
  },
  USDC: {
    aToken: '0x9913dB18a06F5b15b76c1aDDeCdf0d376C771891',
    vToken: '0x6cCB915B29a11F72156aE3B12b0372D1ED5AF291',
    aTokenEPS: '25077160493827200',
    vTokenEPS: '19290123456790100'
  },
  USDT: {
    aToken: '0x6d1082e09575A6bB04291142A6143aF0BBEdCa8d',
    vToken: '0x31aEBf5E0868D5c60C599c601F54712A5381FcbF',
    aTokenEPS: '9645061728395060',
    vTokenEPS: '10609567901234600'
  },
  DAI: {
    aToken: '0xB16dFB94e62d4929DA177Ad9919811954450dF98',
    vToken: '0xD8C097F19ec2E650f64b1e7398b2d3e98c076487',
    aTokenEPS: '23148148148148100',
    vTokenEPS: '19290123456790100'
  },
  WBTC: {
    aToken: '0x677Dff65fD71f5524dfB96C7815326B013F19823',
    vToken: '0xF495851D9d2505F8e81728e2C00C4951e16f8dF1',
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
    }
  );
