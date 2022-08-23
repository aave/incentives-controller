// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {SafeMath} from '../../lib/SafeMath.sol';
import {DistributionTypes} from '../../lib/DistributionTypes.sol';
import {VersionedInitializable} from '@aave/aave-stake/contracts/utils/VersionedInitializable.sol';
import {DistributionManager} from './DistributionManager.sol';
import {IERC20} from '@aave/aave-stake/contracts/interfaces/IERC20.sol';
import {IScaledBalanceToken} from '../../interfaces/IScaledBalanceToken.sol';
import {IAaveIncentivesController} from '../../interfaces/IAaveIncentivesController.sol';

/**
 * @title BaseIncentivesController
 * @notice Abstract contract template to build Distributors contracts for ERC20 rewards to protocol participants
 * @author Aave
 **/
abstract contract BaseIncentivesController is
  IAaveIncentivesController,
  VersionedInitializable,
  DistributionManager
{
  using SafeMath for uint256;

  uint256 public constant REVISION = 1;

  address public override REWARD_TOKEN;

  mapping(address => uint256) internal _usersUnclaimedRewards;

  bool private _claimable = true;

  address private _proxy;

  // Amount of total rewards that this controller will distribute, including all assets
  uint256 private TOTAL_REWARDS;

  // Total amount of rewards that was sent
  uint256 private _totalSent; 

  // How many tokens has each user already claimed (already sent to them)
  mapping(address => uint256) private _userClaimedRewards;

  // this mapping allows whitelisted addresses to claim on behalf of others
  // useful for contracts that hold tokens to be rewarded but don't have any native logic to claim Liquidity Mining rewards
  mapping(address => address) internal _authorizedClaimers;

  modifier onlyAuthorizedClaimers(address claimer, address user) {
    require(_authorizedClaimers[user] == claimer, 'CLAIMER_UNAUTHORIZED');
    _;
  }

  constructor(IERC20 rewardToken, address emissionManager)
    DistributionManager(emissionManager)
  {
    REWARD_TOKEN = address(rewardToken);
  }

  function setClaimable(bool claimable) public onlyEmissionManager {
    _claimable = claimable;
  }

  function setRewardToken(address token) public onlyEmissionManager {
    REWARD_TOKEN = token;
  }

  function setProxy(address proxy) public onlyEmissionManager {
    _proxy = proxy;
  }

  function setTotalRewards(uint256 totalRewards) external onlyEmissionManager {
    TOTAL_REWARDS = totalRewards;
  }

  function getTotalRewards() external view returns (uint256) {
    return TOTAL_REWARDS;
  }

  /// @inheritdoc IAaveIncentivesController
  function configureAssets(address[] calldata assets, uint256[] calldata emissionsPerSecond)
    external
    override
    onlyEmissionManager
  {
    require(assets.length == emissionsPerSecond.length, 'INVALID_CONFIGURATION');

    DistributionTypes.AssetConfigInput[] memory assetsConfig =
      new DistributionTypes.AssetConfigInput[](assets.length);

    for (uint256 i = 0; i < assets.length; i++) {
      require(uint104(emissionsPerSecond[i]) == emissionsPerSecond[i], 'Index overflow at emissionsPerSecond');
      assetsConfig[i].underlyingAsset = assets[i];
      assetsConfig[i].emissionPerSecond = uint104(emissionsPerSecond[i]);
      assetsConfig[i].totalStaked = IScaledBalanceToken(assets[i]).scaledTotalSupply();
    }
    _configureAssets(assetsConfig);
  }

  /// @inheritdoc IAaveIncentivesController
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

  /// This shall be called by a controller proxy.
  function handleProxyAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance,
    address asset
  ) external {
    require(msg.sender == _proxy, "Caller is not proxy");

    uint256 accruedRewards = _updateUserAssetInternal(user, asset, userBalance, totalSupply);
    if (accruedRewards != 0) {
      _usersUnclaimedRewards[user] = _usersUnclaimedRewards[user].add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }
  }

  /// @inheritdoc IAaveIncentivesController
  // Returns the total amount of rewards that a user could eventually claim.
  // The amount a user can actually claim currently is determined by the progressive emission status.
  // see getCurrentClaimableBalance below
  function getRewardsBalance(address[] calldata assets, address user)
    public
    view
    override
    returns (uint256)
  {
    uint256 unclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IScaledBalanceToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }
    unclaimedRewards = unclaimedRewards.add(_getUnclaimedRewards(user, userState));
    return unclaimedRewards;
  }

  // Returns the amount of rewards that a user can actually claim right now.
  function getCurrentClaimableBalance(address[] calldata assets, address user)
    public
    view
    returns (uint256)
  {
    uint256 eventualClaimable = getRewardsBalance(assets, user);
    // how many rewards were granted to this user so far
    uint256 totalRewards = eventualClaimable.add(_userClaimedRewards[user]);
    // how many rewards of totalRewards were already distributed
    uint256 distributedRewards = distributedAmount(totalRewards);

    return distributedRewards.sub(_userClaimedRewards[user]);
  }

  // How many tokens out of total were already distributed by progressive emission strategy
  function distributedAmount(uint256 total)
    internal
    view
    returns (uint256)
  {
    uint256 controllerAccumulatedRewards = _totalSent.add(_vaultBalance());
    controllerAccumulatedRewards = controllerAccumulatedRewards <= TOTAL_REWARDS
      ? controllerAccumulatedRewards
      : TOTAL_REWARDS;

    return total.mul(controllerAccumulatedRewards).div(TOTAL_REWARDS);
  }

  /// @inheritdoc IAaveIncentivesController
  function claimRewards(
    address[] calldata assets,
    uint256 amount,
    address to
  ) external override returns (uint256) {
    require(to != address(0), 'INVALID_TO_ADDRESS');
    return _claimRewards(assets, amount, msg.sender, msg.sender, to);
  }

  /// @inheritdoc IAaveIncentivesController
  function claimRewardsOnBehalf(
    address[] calldata assets,
    uint256 amount,
    address user,
    address to
  ) external override onlyAuthorizedClaimers(msg.sender, user) returns (uint256) {
    require(user != address(0), 'INVALID_USER_ADDRESS');
    require(to != address(0), 'INVALID_TO_ADDRESS');
    return _claimRewards(assets, amount, msg.sender, user, to);
  }

  /// @inheritdoc IAaveIncentivesController
  function claimRewardsToSelf(address[] calldata assets, uint256 amount)
    external
    override
    returns (uint256)
  {
    return _claimRewards(assets, amount, msg.sender, msg.sender, msg.sender);
  }

  /// @inheritdoc IAaveIncentivesController
  function setClaimer(address user, address caller) external override onlyEmissionManager {
    _authorizedClaimers[user] = caller;
    emit ClaimerSet(user, caller);
  }

  /// @inheritdoc IAaveIncentivesController
  function getClaimer(address user) external view override returns (address) {
    return _authorizedClaimers[user];
  }

  /// @inheritdoc IAaveIncentivesController
  function getUserUnclaimedRewards(address _user) external view override returns (uint256) {
    return _usersUnclaimedRewards[_user];
  }

  /**
   * @dev returns the revision of the implementation contract
   */
  function getRevision() internal pure override returns (uint256) {
    return REVISION;
  }

  /**
   * @dev Claims reward for an user on behalf, on all the assets of the lending pool, accumulating the pending rewards.
   * @param amount Amount of rewards to claim. In fact we will ignore this param and always claim all possible rewards.
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
  ) internal virtual returns (uint256) {
    require(_claimable, 'Not claimable now');

    if (amount == 0) {
      return 0;
    }
    uint256 totalUnclaimedRewards = _usersUnclaimedRewards[user];

    DistributionTypes.UserStakeInput[] memory userState =
      new DistributionTypes.UserStakeInput[](assets.length);
    for (uint256 i = 0; i < assets.length; i++) {
      userState[i].underlyingAsset = assets[i];
      (userState[i].stakedByUser, userState[i].totalStaked) = IScaledBalanceToken(assets[i])
        .getScaledUserBalanceAndSupply(user);
    }

    uint256 accruedRewards = _claimRewards(user, userState);
    if (accruedRewards != 0) {
      totalUnclaimedRewards = totalUnclaimedRewards.add(accruedRewards);
      emit RewardsAccrued(user, accruedRewards);
    }

    if (totalUnclaimedRewards == 0) {
      return 0;
    }

    // uint256 amountToClaim = amount > unclaimedRewards ? unclaimedRewards : amount;
    // _usersUnclaimedRewards[user] = unclaimedRewards - amountToClaim; // Safe due to the previous line
    uint256 userTotalRewards = totalUnclaimedRewards.add(_userClaimedRewards[user]);
    uint256 amountToClaim = distributedAmount(userTotalRewards).sub(_userClaimedRewards[user]);
    
    _usersUnclaimedRewards[user] = totalUnclaimedRewards.sub(amountToClaim);
    _userClaimedRewards[user] = _userClaimedRewards[user].add(amountToClaim);

    _totalSent = _totalSent.add(amountToClaim);

    _transferRewards(to, amountToClaim);
    emit RewardsClaimed(user, to, claimer, amountToClaim);

    return amountToClaim;
  }

  /**
   * @dev Abstract function to transfer rewards to the desired account
   * @param to Account address to send the rewards
   * @param amount Amount of rewards to transfer
   */
  function _transferRewards(address to, uint256 amount) internal virtual;

  /**
   * @dev Vault balance of reward token
   */
  function _vaultBalance() internal view virtual returns (uint256);
}
