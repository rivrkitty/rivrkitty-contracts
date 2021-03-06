// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./RivrKitty.sol";
import "./LPMigrator.sol";

contract Factory {
    using SafeERC20 for IERC20;

    RivrKitty public token;
    LPMigrator public migrator;

    uint256 public constant MIGRATOR_APPROVAL_DELAY = 1 weeks;

    constructor(address _router, address _devAddress) payable {
        token = new RivrKitty(_devAddress);

        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "!no tokens");

        migrator = new LPMigrator(
            address(token),
            _router,
            MIGRATOR_APPROVAL_DELAY
        );
        IERC20(address(token)).safeTransfer(address(migrator), bal);
        migrator.initializeLiquidity{value: msg.value}();
        migrator.transferOwnership(_devAddress);

        token.enableWhaleBlocking();
    }
}
