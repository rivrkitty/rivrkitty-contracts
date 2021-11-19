// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";

import "./KittyPaws.sol";
import "./PawsChef.sol";

contract ChefFactory {
    using SafeMath for uint256;

    uint256 private constant PEWS_PER_MONTH = 4000;
    uint256 private constant BLOCK_TIME_IN_SECONDS = 12;

    KittyPaws public paws;
    PawsChef public chef;

    constructor(address _feeAddress, address _devAddress) payable {
        paws = new KittyPaws();

        chef = new PawsChef(
            paws,
            PEWS_PER_MONTH.mul(1e18).mul(BLOCK_TIME_IN_SECONDS).div(30 days)
        );
        chef.setFeeAddress(_feeAddress);
        // move later to multisig with timelock
        chef.transferOperator(_devAddress);
        chef.transferOwnership(_devAddress);

        paws.transferOwnership(address(chef));
    }
}
