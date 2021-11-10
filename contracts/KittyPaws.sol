// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract KityPaws is ERC20("KittyPaws", "PAWS"), Ownable {
    /// @notice Creates `_amount` token to `_to`. Must only be called by the owner (PawsChef).
    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
