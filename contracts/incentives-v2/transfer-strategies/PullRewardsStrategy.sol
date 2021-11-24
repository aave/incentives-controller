pragma solidity 0.8.10;

import {SafeERC20} from '../../lib/SafeERC20.sol';
import {ITransferStrategy} from '../../interfaces/ITransferStrategy.sol';
import {IERC20} from '../../interfaces/IERC20.sol';
import {TransferStrategyStorage} from './TransferStrategyStorage.sol';

/**
 * @title PullRewardsTransferStrategy
 * @notice Transfer strategy that pulls ERC20 rewards from an external account to the user address.
 * The external account could be a smart contract or EOA that must approve to the IncentivesController address that uses this logic contract.
 * @author Aave
 **/
contract PullRewardsTransferStrategy is TransferStrategyStorage, ITransferStrategy {
  using SafeERC20 for IERC20;

  address internal immutable REWARDS_VAULT;

  constructor(address rewardsVault) {
    REWARDS_VAULT = rewardsVault;
    isTransferStrategy = true;
  }

  /// @inheritdoc ITransferStrategy
  function installHook(bytes memory) external override onlyDelegateCall returns (bool) {
    return true;
  }

  /// @inheritdoc ITransferStrategy
  function performTransfer(
    address to,
    address reward,
    uint256 amount
  ) external onlyDelegateCall returns (bool) {
    IERC20(reward).safeTransferFrom(REWARDS_VAULT, to, amount);

    return true;
  }

  function getRewardsVault() external view returns (address) {
    return REWARDS_VAULT;
  }
}
