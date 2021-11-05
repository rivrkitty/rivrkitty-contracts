// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Capped.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/TokenTimelock.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./interfaces/IUniswapV2Router02.sol";

contract RivrKitty is ERC20, Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;
    
    address public immutable firstTimelockAddress;
    address public immutable secondTimelockAddress;
    address public immutable thirdTimelockAddress;
    address public immutable fourthTimelockAddress;
    
    uint256 public immutable startTime;
    
    bool public whaleBlockingEnabled = false;
    
    uint256 private constant TOKENS_COUNT = 1000000000000;
    uint256 private constant TEAM_TOKENS_PERCENT = 4;
    
    uint256 public constant TEAM_TOKENS_PART_LOCK = 4 weeks;
    uint256 public constant WHALES_TIMEOUT = 1 weeks;

    constructor() ERC20("RivrKitty", "KITTY") payable {
        startTime = block.timestamp;
        
        uint256 allTokens = TOKENS_COUNT * 10 ** decimals();

        uint256 teamAmount = allTokens.mul(TEAM_TOKENS_PERCENT).div(100);
        uint256 teamPartAmount = teamAmount.div(4);
        
        firstTimelockAddress = _mintTokens(block.timestamp + TEAM_TOKENS_PART_LOCK, teamPartAmount);
        secondTimelockAddress = _mintTokens(block.timestamp + TEAM_TOKENS_PART_LOCK * 2, teamPartAmount);
        thirdTimelockAddress = _mintTokens(block.timestamp + TEAM_TOKENS_PART_LOCK * 3, teamPartAmount);
        fourthTimelockAddress = _mintTokens(block.timestamp + TEAM_TOKENS_PART_LOCK * 4, teamPartAmount);
        
        ERC20._mint(address(_msgSender()), allTokens.sub(teamAmount));
    }
    
    function _mintTokens(uint256 _releaseTime, uint256 _amount) internal returns (address) {
        TokenTimelock firstTimelock = new TokenTimelock(this, _msgSender(), _releaseTime);
        ERC20._mint(address(firstTimelock), _amount);
        return address(firstTimelock);
    }
    
    function transfer(address recipient, uint256 amount) public virtual override returns (bool) {
        if (whaleBlockingEnabled && (block.timestamp - startTime) < WHALES_TIMEOUT) {
            // To allow adding to LP
            uint256 newBal = this.balanceOf(recipient).add(amount);
            uint256 maxBal = totalSupply().mul(3).div(100);
            require(newBal < maxBal, "!whale reject");
        }
        
        _transfer(_msgSender(), recipient, amount);
        
        return true;
    }

    function enableWhaleBlocking() public onlyOwner {
        whaleBlockingEnabled = true;
    }
}