// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "./KittyPaws.sol";
import "./PawsChef.sol";

contract ChefFactory {
    KittyPaws public paws;
    PawsChef public chef;

    constructor(address _feeAddress, address _multisig) payable {
        paws = new KittyPaws();

        chef = new PawsChef(paws, 1e18);
        chef.setFeeAddress(_feeAddress);
        // TODO: Wrap multisig into timelock and set timelock as operator
        chef.transferOperator(_multisig);

        paws.transferOwnership(address(chef));
    }
}
