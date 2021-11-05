// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "./RivrKitty.sol";

contract Factory {
    
    RivrKitty public token;

    constructor(address _router) payable {
        token = new RivrKitty();

        uint256 bal = token.balanceOf(address(this));
        require(bal > 0, "!no tokens");
        
        token.approve(_router, bal);
        IUniswapV2Router02(_router).addLiquidityETH{value: msg.value}(
            address(token), bal, bal, msg.value, address(0x0), block.timestamp
        );

        token.enableWhaleBlocking();
    }
}