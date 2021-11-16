// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "../PawsChef.sol";
import "../interfaces/IMasterChef.sol";

contract AdditionalRewardCalc {
    using SafeMath for uint256;

    function pendingRewards(
        address chef,
        uint256 poolId,
        address user
    ) public view returns (uint256 rewards) {
        (
            ,
            ,
            ,
            ,
            ,
            uint256 totalLp,
            address addRewardChef,
            uint256 addRewardChefPid,
            ,
            uint256 accAddRewardsPerShare
        ) = PawsChef(chef).poolInfo(poolId);
        (uint256 amount, , uint256 addRewardDebt) = PawsChef(chef).userInfo(
            poolId,
            user
        );

        uint256 pendingReward = IMasterChef(addRewardChef).pendingReward(
            addRewardChefPid,
            chef
        );
        accAddRewardsPerShare = accAddRewardsPerShare.add(
            pendingReward.mul(1e12).div(totalLp)
        );
        return amount.mul(accAddRewardsPerShare).div(1e12).sub(addRewardDebt);
    }

    // function pawsPerWeek(
    //     address chef,
    //     uint256 poolId,
    //     address user
    // ) public view returns (uint256 paws) {
    //     (, uint256 allocPoint, , , , , , , , ) = PawsChef(chef).poolInfo(
    //         poolId
    //     );
    //     uint256 pawsPerBlock = PawsChef(chef).pawsPerBlock();
    //     uint256 totalAllocPoint = PawsChef(chef).totalAllocPoint();
    //     uint256 multiplier = PawsChef(chef).getMultiplier(
    //         pool.lastRewardBlock,
    //         block.number
    //     );
    // }
}
