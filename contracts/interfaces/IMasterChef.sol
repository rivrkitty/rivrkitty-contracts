// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMasterChef {
    function deposit(uint256 _pid, uint256 _amount) external;

    function withdraw(uint256 _pid, uint256 _amount) external;

    function userInfo(uint256 _pid, address _user)
        external
        view
        returns (uint256, uint256);

    function emergencyWithdraw(uint256 _pid) external;

    function pendingReward(uint256 _pid, address _user)
        external
        view
        returns (uint256);
}
