// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {DistributionTypes} from '@aave/aave-stake/contracts/lib/DistributionTypes.sol';
import {SafeMath} from '../lib/SafeMath.sol';

import {IERC20} from '@aave/aave-stake/contracts/interfaces/IERC20.sol';
import {IAToken} from '@aave/aave-stake/contracts/interfaces/IAToken.sol';
import {IAaveIncentivesController} from '../interfaces/IAaveIncentivesController.sol';
import {IStakedToken} from '@aave/aave-stake/contracts/interfaces/IStakedToken.sol';
import {VersionedInitializable} from '@aave/aave-stake/contracts/utils/VersionedInitializable.sol';
import {AaveDistributionManager} from './AaveDistributionManager.sol';

interface IStakedTokenWithConfig is IStakedToken {
  function STAKED_TOKEN() external view returns(uint256);
}

/**
 * @title AaveIncentivesController
 * @notice Distributor contract for rewards to the Aave protocol
 * @author Aave
 **/
contract AaveIncentivesController is
  IAaveIncentivesController,
  VersionedInitializable,
  AaveDistributionManager
{
  using SafeMath for uint256;
  uint256 public constant REVISION = 1;

  IStakedTokenWithConfig public immutable _safetyModule;

  address internal _rewardsVault;

  mapping(address => uint256) internal _usersUnclaimedRewards;

  // this mapping allows whitelisted addresses to claim on behalf of others
  // useful for contracts that hold tokens to be rewarded but don't have any native logic to claim Liquidity Mining rewards
  mapping(address => address) internal _authorizedClaimers;

  event RewardsAccrued(address indexed user, uint256 amount);
  event RewardsClaimed(address indexed user, address indexed to, address indexed claimer, uint256 amount);
  event ClaimerSet(address indexed user, address indexed claimer);

  modifier onlyAuthorizedClaimers(address user, address caller) {
    require(_authorizedClaimers[user] == caller, 'CLAIMER_UNAUTHORIZED');
    _;
  }

  constructor(
    IStakedTokenWithConfig safetyModule,
    address emissionManager
  ) AaveDistributionManager(emissionManager) {
    _safetyModule = safetyModule;
  }

  /**
   * @dev Initialize AaveIncentivesController
   * @param addressesProvider address of the addresses provider for this incentives controller
   **/
  function initialize(
    address addressesProvider
  ) external initializer {

    //approves the safety module to allow staking
    IERC20(_safetyModule.STAKED_TOKEN()).approve(address(_safetyModule), type(uint256).max);
  }

  /**
   * @dev Called by the corresponding asset on any update that affects the rewards distribution
   * @param user The address of the user
   * @param totalSupply The total supply of the asset in the lending pool
   * @param userBalance The balance of the user of the asset in the lending pool
   **/
  function handleAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance
  ) external override {
    uint256 accruedRewards = _updateUserAssetInternal(user, msg.sender, userBalance, totalSupply);
    if (accruedRewards != 0) {
      _usersUnclaimedRewards[user] = _usersUnclaimedRewards[user].add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }
  }

  /**
   * @dev Returns the total of rewards of an user, already accrued + not yet accrued
   * @param user The address of the user
   * @return The rewards
   **/
  function getRewardsBalance(address[] calldata assets, address user)
    external
    view
    override
    returns (uint256)
  {
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IAToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }
    unclaimedRewards = unclaimedRewards.add(_getUnclaimedRewards(user, userState));
    return unclaimedRewards;
  }

  /**
   * @dev Claims reward for an user, on all the assets of the lending pool, accumulating the pending rewards
   * @param amount Amount of rewards to claim
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external override returns (uint256) {
    return _claimRewards(assets, amount, msg.sender, msg.sender, to);
  }

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards. The caller must
   * be whitelisted via "allowClaimOnBehalf" function by the RewardsAdmin role manager
   * @param amount Amount of rewards to claim
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function claimRewardsOnBehalf(
    address[] calldata assets,
    uint256 amount,
    address user,
    address to
  ) external override  onlyAuthorizedClaimers(msg.sender, user) returns (uint256) {
    return _claimRewards(assets, amount, msg.sender, user, to);
  }

  function setClaimer(address user, address caller) external override onlyEmissionManager {
    _authorizedClaimers[user] = caller;
    emit ClaimerSet(user, caller);
  }

  function getClaimer(address user) external view override returns (address) {
    return _authorizedClaimers[user];
  }

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards.
   * @param amount Amount of rewards to claim
   * @param user Address to check and claim rewards
   * @param to Address that will be receiving the rewards
   * @return Rewards claimed
   **/
  function _claimRewards(
    address[] calldata assets,
    uint256 amount,
    address claimer,
    address user,
    address to
  ) internal returns (uint256) {
    if (amount == 0) {
      return 0;
    }
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IAToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }

    uint256 accruedRewards = _claimRewards(user, userState);
    if (accruedRewards != 0) {
      unclaimedRewards = unclaimedRewards.add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }

    if (unclaimedRewards == 0) {
      return 0;
    }

    uint256 amountToClaim = amount > unclaimedRewards ? unclaimedRewards : amount;
    _usersUnclaimedRewards[user] = unclaimedRewards - amountToClaim; // Safe due to the previous line

    _safetyModule.stake(to, amountToClaim);
    emit RewardsClaimed(user, to, claimer, amountToClaim);

    return amountToClaim;
  }

  /**
   * @dev returns the unclaimed rewards of the user
   * @param _user the address of the user
   * @return the unclaimed user rewards
   */
  function getUserUnclaimedRewards(address _user) external view returns (uint256) {
    return _usersUnclaimedRewards[_user];
  }

  /**
   * @dev returns the revision of the implementation contract
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }
}
