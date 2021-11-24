// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.8.10;

import {IAaveDistributionManagerV2} from './IAaveDistributionManagerV2.sol';
import {DistributionTypesV2} from '../lib/DistributionTypesV2.sol';
import {ITransferStrategy} from './ITransferStrategy.sol';

interface IAaveIncentivesControllerV2 is IAaveDistributionManagerV2 {
  event ClaimerSet(address indexed user, address indexed claimer);

  event RewardsClaimed(
    address indexed user,
    address indexed reward,
    address indexed to,
    address claimer,
    uint256 amount
  );

  event TransferStrategyInstalled(address indexed reward, address indexed transferStrategy);

  /**
   * @dev Whitelists an address to claim the rewards on behalf of another address
   * @param user The address of the user
   * @param claimer The address of the claimer
   */
  function setClaimer(address user, address claimer) external;

  /**
   * @dev Sets a TransferStrategy logic contract that determines the logic of the rewards transfer
   * @param reward The address of the reward token
   * @param transferStrategy The address of the TransferStrategy logic contract
   * @param params Extra parameters encoded in bytes to pass to TransferStrategy install hook function
   */
  function setTransferStrategy(
    address reward,
    ITransferStrategy transferStrategy,
    bytes memory params
  ) external;

  /**
   * @dev Returns the whitelisted claimer for a certain address (0x0 if not set)
   * @param user The address of the user
   * @return The claimer address
   */
  function getClaimer(address user) external view returns (address);

  /**
   * @dev Configure assets for a certain rewards emission
   * @param config The assets configuration
   */
  function configureAssets(DistributionTypesV2.RewardsConfigInput[] memory config) external;

  /**
   * @dev Called by the corresponding asset on any update that affects the rewards distribution
   * @param asset The address of the user
   * @param userBalance The balance of the user of the asset in the lending pool
   * @param totalSupply The total supply of the asset in the lending pool
   **/
  function handleAction(
    address asset,
    uint256 userBalance,
    uint256 totalSupply
  ) external;

  /**
   * @dev Claims reward for an user to the desired address, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param to Address that will be receiving the rewards
   * @param reward Address of the reward token
   * @return Rewards claimed
   **/
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to,
    address reward
  ) external returns (uint256);

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards. The caller must
   * be whitelisted via "allowClaimOnBehalf" function by the RewardsAdmin role manager
   * @param amount Amount of rewards to claim
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @param reward Address of the reward token
   * @return Rewards claimed
   **/
  function claimRewardsOnBehalf(
    address[] calldata assets,
    uint256 amount,
    address user,
    address to,
    address reward
  ) external returns (uint256);

  /**
   * @dev Claims reward for msg.sender, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param reward Address of the reward token
   * @return Rewards claimed
   **/
  function claimRewardsToSelf(
    address[] calldata assets,
    uint256 amount,
    address reward
  ) external returns (uint256);

  /**
   * @dev Claims all rewards for an user to the desired address, on all the assets of the lending pool, accumulating the pending rewards
   * @param assets List of assets to check unrealized rewards
   * @param to Address that will be receiving the rewards
   * @return rewardsList List of addresses of the reward tokens and claimedAmounts, the list that contains the claimed amount per reward, following same order as "rewardList"
   * @return claimedAmounts List that contains the claimed amount per reward, following same order as "rewardList"
   **/
  function claimAllRewards(address[] calldata assets, address to)
    external
    returns (address[] memory rewardsList, uint256[] memory claimedAmounts);

  /**
   * @dev Claims all rewards for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards. The caller must
   * be whitelisted via "allowClaimOnBehalf" function by the RewardsAdmin role manager
   * @param assets List of assets to check unrealized rewards
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @return rewardsList List of addresses of the reward tokens and claimedAmounts, the list that contains the claimed amount per reward, following same order as "rewardList"
   * @return claimedAmounts List that contains the claimed amount per reward, following same order as "rewardsList"
   **/
  function claimAllRewardsOnBehalf(
    address[] calldata assets,
    address user,
    address to
  ) external returns (address[] memory rewardsList, uint256[] memory claimedAmounts);

  /**
   * @dev Claims all reward for msg.sender, on all the assets of the lending pool, accumulating the pending rewards
   * @param assets List of assets to check unrealized rewards
   * @return rewardsList List of addresses of the reward tokens and claimedAmounts, the list that contains the claimed amount per reward, following same order as "rewardList"
   * @return claimedAmounts List that contains the claimed amount per reward, following same order as "rewardsList"
   **/
  function claimAllRewardsToSelf(address[] calldata assets)
    external
    returns (address[] memory rewardsList, uint256[] memory claimedAmounts);
}
