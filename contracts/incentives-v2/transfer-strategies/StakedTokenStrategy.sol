// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import {SafeERC20} from '../../lib/SafeERC20.sol';
import {IERC20} from '../../interfaces/IERC20.sol';
import {IStakedTokenWithConfigV8} from '../../interfaces/IStakedTokenWithConfigV8.sol';
import {ITransferStrategy} from '../../interfaces/ITransferStrategy.sol';
import {TransferStrategyStorage} from './TransferStrategyStorage.sol';
import 'hardhat/console.sol';

/**
 * @title StakedTokenTransferStrategy
 * @notice Transfer strategy that stakes the rewards into a staking contract and transfers the staking contract token.
 * @author Aave
 **/
contract StakedTokenTransferStrategy is TransferStrategyStorage, ITransferStrategy {
  using SafeERC20 for IERC20;

  IStakedTokenWithConfigV8 public immutable STAKE_CONTRACT;
  address public immutable UNDERLYING_TOKEN;

  constructor(IStakedTokenWithConfigV8 stakeToken) {
    STAKE_CONTRACT = stakeToken;
    UNDERLYING_TOKEN = STAKE_CONTRACT.STAKED_TOKEN();
    isTransferStrategy = true;
  }

  /// @inheritdoc ITransferStrategy
  function installHook(bytes memory) external override onlyDelegateCall returns (bool) {
    IERC20(UNDERLYING_TOKEN).safeApprove(address(STAKE_CONTRACT), 0);
    IERC20(UNDERLYING_TOKEN).safeApprove(address(STAKE_CONTRACT), type(uint256).max);

    return true;
  }

  /// @inheritdoc ITransferStrategy
  function performTransfer(
    address to,
    address reward,
    uint256 amount
  ) external override onlyDelegateCall returns (bool) {
    require(reward == address(STAKE_CONTRACT), 'Reward token is not the staked token');

    STAKE_CONTRACT.stake(to, amount);

    return true;
  }
}
