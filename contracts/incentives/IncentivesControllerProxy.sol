// SPDX-License-Identifier: agpl-3.0
pragma solidity 0.7.5;
pragma experimental ABIEncoderV2;

import {Ownable} from "../utils/Ownable.sol";
import {BaseIncentivesController} from "./base/BaseIncentivesController.sol";


contract IncentivesControllerProxy is Ownable {
  BaseIncentivesController[] private _controllers;

  constructor(address[] memory controllers) {
    for (uint256 i = 0; i < controllers.length; i++) {
      _controllers.push(BaseIncentivesController(controllers[i]));
    }
  }

  function handleAction(
    address user,
    uint256 totalSupply,
    uint256 userBalance
  ) external {
    for (uint256 i = 0; i < _controllers.length; i++) {
      _controllers[i].handleProxyAction(user, totalSupply, userBalance, msg.sender);
    }
  }
}
