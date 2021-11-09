// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./interfaces/IUniswapV2Router02.sol";
import "./interfaces/IUniswapV2Factory.sol";

contract LPMigrator is Ownable {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    struct RouterCandidate {
        address router;
        uint256 proposedTime;
    }

    address public router;
    uint256 public approvalDelay;
    address public immutable token;
    bool public initialized = false;
    // The last proposed strategy to switch to.
    RouterCandidate public routerCandidate;

    event NewRouterCandidate(address router);
    event UpgradeRouter(address router);

    constructor(
        address _token,
        address _router,
        uint256 _approvalDelay
    ) {
        token = _token;
        approvalDelay = _approvalDelay;
        router = _router;
    }

    function proposeRouter(address _router) public onlyOwner {
        routerCandidate = RouterCandidate({
            router: _router,
            proposedTime: block.timestamp
        });

        emit NewRouterCandidate(_router);
    }

    function upgradeRouter() public onlyOwner {
        require(routerCandidate.router != address(0), "There is no candidate");
        require(
            routerCandidate.proposedTime.add(approvalDelay) < block.timestamp,
            "Delay has not passed"
        );

        emit UpgradeRouter(routerCandidate.router);

        _removeLiquidity();
        router = routerCandidate.router;

        routerCandidate.router = address(0);
        routerCandidate.proposedTime = 5000000000;

        _addLiquidity();
    }

    function initializeLiquidity() public payable onlyOwner {
        require(initialized == false, "!already initialized");
        require(msg.value > 0, "!eth bal == 0");
        uint256 tokenBal = IERC20(token).balanceOf(address(this));
        require(tokenBal > 0, "!tokenBal == 0");

        IERC20(token).safeApprove(router, 0);
        IERC20(token).safeApprove(router, tokenBal);

        IUniswapV2Router02(router).addLiquidityETH{value: msg.value}(
            address(token),
            tokenBal,
            tokenBal,
            msg.value,
            address(this),
            block.timestamp
        );
        initialized = true;
    }

    function increaseApprovalDelayTo(uint256 _approvalDelay) public onlyOwner {
        require(
            _approvalDelay > approvalDelay,
            "!new approval delay smaller than old"
        );
        approvalDelay = _approvalDelay;
    }

    function _removeLiquidity() internal {
        IUniswapV2Router02 rout = IUniswapV2Router02(router);
        IUniswapV2Factory factory = IUniswapV2Factory(rout.factory());
        address pair = factory.getPair(token, rout.WETH());
        uint256 lpBal = IERC20(pair).balanceOf(address(this));

        IERC20(pair).safeApprove(router, lpBal);
        rout.removeLiquidity(
            token,
            rout.WETH(),
            lpBal,
            1,
            1,
            address(this),
            block.timestamp
        );
    }

    function _addLiquidity() internal {
        address weth = IUniswapV2Router02(router).WETH();
        uint256 tokenBal = IERC20(token).balanceOf(address(this));
        uint256 wethBal = IERC20(weth).balanceOf(address(this));
        require(tokenBal > 0, "!tokenBal == 0");
        require(wethBal > 0, "!wethBal == 0");

        IERC20(token).safeApprove(router, 0);
        IERC20(token).safeApprove(router, tokenBal);

        IERC20(weth).safeApprove(router, 0);
        IERC20(weth).safeApprove(router, wethBal);

        // we need to send to lp at least 95% of each token
        IUniswapV2Router02(router).addLiquidity(
            token,
            weth,
            tokenBal,
            wethBal,
            tokenBal.mul(95).div(100),
            wethBal.mul(95).div(100),
            address(this),
            block.timestamp
        );

        // LP can already exist, so remaining token balances we will send to dev addres so that he do smmth with it
        uint256 newTokenBal = IERC20(token).balanceOf(address(this));
        if (newTokenBal > 0) {
            IERC20(token).safeTransfer(owner(), newTokenBal);
        }
        uint256 newWethBal = IERC20(weth).balanceOf(address(this));
        if (newWethBal > 0) {
            IERC20(weth).safeTransfer(owner(), newWethBal);
        }
    }
}
