// SPDX-License-Identifier: GPL-3.0

pragma solidity ^0.8.2;

import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./KittyPaws.sol";
import "./interfaces/IMasterChef.sol";

// Copied and changed from SolarDistributor with few twicks - removed meta, forwarder, lockup, devAddress.
// Added possibility to add LP to for additional farm rewards
contract PawsChef is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. Paws to distribute per block.
        uint256 lastRewardBlock; // Last block number that Paws distribution occurs.
        uint256 accPawsPerShare; // Accumulated Paws per share, times 1e12. See below.
        uint16 depositFeeBP; // Deposit fee in basis points
        uint256 totalLp; // Total token in Pool
        address addRewardChef; // Additional reward chef - lpToken will be deposited in that chef, not in PawsChef
        uint256 addRewardChefPid; // Additional reward chef pid - pid of farm at additional reward chef
        address addRewardToken; // Additional reward token that user gets
    }

    KittyPaws public paws;

    // The operator can only update EmissionRate and AllocPoint to protect tokenomics
    //i.e some wrong setting and a pools get too much allocation accidentally
    address private _operator;

    // Deposit Fee address
    address public feeAddress;

    // Paws tokens created per block
    uint256 public pawsPerBlock;

    // Maximum deposit fee rate: 10%
    uint16 public constant MAXIMUM_DEPOSIT_FEE_RATE = 1000;

    // Info of each pool
    PoolInfo[] public poolInfo;

    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;

    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;

    // The block number when Paws mining starts.
    uint256 public startBlock;

    // Total Paws in Paws Pools (can be multiple pools)
    uint256 public totalPawsInPools = 0;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event EmissionRateUpdated(
        address indexed caller,
        uint256 previousAmount,
        uint256 newAmount
    );
    event OperatorTransferred(
        address indexed previousOperator,
        address indexed newOperator
    );
    event FeeAddressChanged(
        address indexed caller,
        address oldAddress,
        address newAddress
    );
    event AllocPointsUpdated(
        address indexed caller,
        uint256 previousAmount,
        uint256 newAmount
    );

    modifier onlyOperator() {
        require(
            _operator == msg.sender,
            "Operator: caller is not the operator"
        );
        _;
    }

    constructor(KittyPaws _paws, uint256 _pawsPerBlock) {
        //StartBlock always many years later from contract construct, will be set later in StartFarming function
        startBlock = block.number + (10 * 365 * 24 * 60 * 60);

        paws = _paws;
        pawsPerBlock = _pawsPerBlock;

        feeAddress = msg.sender;
        _operator = msg.sender;
        emit OperatorTransferred(address(0), _operator);
    }

    function operator() public view returns (address) {
        return _operator;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to)
        public
        pure
        returns (uint256)
    {
        return _to.sub(_from);
    }

    function transferOperator(address newOperator) public onlyOperator {
        require(
            newOperator != address(0),
            "TransferOperator: new operator is the zero address"
        );
        emit OperatorTransferred(_operator, newOperator);
        _operator = newOperator;
    }

    // Set farming start, can call only once
    function startFarming() public onlyOwner {
        require(block.number < startBlock, "Error::Farm started already");

        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            PoolInfo storage pool = poolInfo[pid];
            pool.lastRewardBlock = block.number;
        }

        startBlock = block.number;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // Can add multiple pool with same lp token without messing up rewards, because each pool's balance is tracked using its own totalLp
    function add(
        uint256 _allocPoint,
        IERC20 _lpToken,
        uint16 _depositFeeBP,
        bool _withUpdate
    ) public onlyOwner {
        require(
            _depositFeeBP <= MAXIMUM_DEPOSIT_FEE_RATE,
            "add: deposit fee too high"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accPawsPerShare: 0,
                depositFeeBP: _depositFeeBP,
                totalLp: 0,
                addRewardChef: address(0x0),
                addRewardChefPid: 0,
                addRewardToken: address(0x0)
            })
        );
    }

    function addWithAddReward(
        uint256 _allocPoint,
        IERC20 _lpToken,
        uint16 _depositFeeBP,
        bool _withUpdate,
        address _addRewardChef,
        uint256 _addRewardChefPid,
        address _addRewardToken
    ) public onlyOwner {
        require(
            _depositFeeBP <= MAXIMUM_DEPOSIT_FEE_RATE,
            "addWithAddReward: deposit fee too high"
        );
        require(
            _addRewardChef != address(0x0),
            "addWithAddReward: reward chef cannot be 0x0"
        );
        require(
            _addRewardToken != address(0x0),
            "addWithAddReward: reward token cannot be 0x0"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock
            ? block.number
            : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accPawsPerShare: 0,
                depositFeeBP: _depositFeeBP,
                totalLp: 0,
                addRewardChef: _addRewardChef,
                addRewardChefPid: _addRewardChefPid,
                addRewardToken: _addRewardToken
            })
        );

        IERC20(_lpToken).safeApprove(_addRewardChef, type(uint128).max);
    }

    // Update the given pool's Paws allocation point and deposit fee. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        uint16 _depositFeeBP,
        bool _withUpdate
    ) public onlyOwner {
        require(
            _depositFeeBP <= MAXIMUM_DEPOSIT_FEE_RATE,
            "set: deposit fee too high"
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFeeBP = _depositFeeBP;
    }

    // View function to see pending Paws on frontend.
    function pendingPaws(uint256 _pid, address _user)
        external
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accPawsPerShare = pool.accPawsPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));

        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier = getMultiplier(
                pool.lastRewardBlock,
                block.number
            );
            uint256 pawsReward = multiplier
                .mul(pawsPerBlock)
                .mul(pool.allocPoint)
                .div(totalAllocPoint);
            accPawsPerShare = accPawsPerShare.add(
                pawsReward.mul(1e12).div(lpSupply)
            );
        }

        return user.amount.mul(accPawsPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward vairables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }

        uint256 lpSupply = pool.totalLp;
        if (lpSupply == 0 || pool.allocPoint == 0) {
            pool.lastRewardBlock = block.number;
            return;
        }

        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 pawsReward = multiplier
            .mul(pawsPerBlock)
            .mul(pool.allocPoint)
            .div(totalAllocPoint);

        paws.mint(address(this), pawsReward);

        pool.accPawsPerShare = pool.accPawsPerShare.add(
            pawsReward.mul(1e12).div(pool.totalLp)
        );
        pool.lastRewardBlock = block.number;

        if (isAddRewardPool(_pid)) {
            IMasterChef(pool.addRewardChef).deposit(pool.addRewardChefPid, 0);
        }
    }

    // Deposit LP tokens to MasterChef for Paws allocation.
    function deposit(uint256 _pid, uint256 _amount) public nonReentrant {
        require(
            block.number >= startBlock,
            "PawsChef: Can not deposit before start"
        );

        updatePool(_pid);

        payPendingPaws(_pid);
        payPendingAddRewards(_pid);

        if (isAddRewardPool(_pid)) {
            _depositWithReward(_pid, _amount);
        } else {
            _depositWithoutReward(_pid, _amount);
        }

        emit Deposit(_msgSender(), _pid, _amount);
    }

    function _depositWithoutReward(uint256 _pid, uint256 _amount) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];

        if (_amount > 0) {
            uint256 beforeDeposit = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(_msgSender(), address(this), _amount);
            uint256 afterDeposit = pool.lpToken.balanceOf(address(this));

            _amount = afterDeposit.sub(beforeDeposit);

            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, depositFee);

                _amount = _amount.sub(depositFee);
            }

            user.amount = user.amount.add(_amount);
            pool.totalLp = pool.totalLp.add(_amount);

            if (address(pool.lpToken) == address(paws)) {
                totalPawsInPools = totalPawsInPools.add(_amount);
            }
        }

        user.rewardDebt = user.amount.mul(pool.accPawsPerShare).div(1e12);
    }

    function _depositWithReward(uint256 _pid, uint256 _amount) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];

        if (_amount > 0) {
            uint256 beforeDeposit = pool.lpToken.balanceOf(address(this));
            pool.lpToken.safeTransferFrom(_msgSender(), address(this), _amount);
            uint256 afterDeposit = pool.lpToken.balanceOf(address(this));

            _amount = afterDeposit.sub(beforeDeposit);

            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, depositFee);

                _amount = _amount.sub(depositFee);
            }

            (uint256 beforeChefDeposit, ) = IMasterChef(pool.addRewardChef)
                .userInfo(pool.addRewardChefPid, address(this));
            IMasterChef(pool.addRewardChef).deposit(
                pool.addRewardChefPid,
                _amount
            );
            (uint256 afterChefDeposit, ) = IMasterChef(pool.addRewardChef)
                .userInfo(pool.addRewardChefPid, address(this));

            _amount = afterChefDeposit.sub(beforeChefDeposit);

            user.amount = user.amount.add(_amount);
            pool.totalLp = pool.totalLp.add(_amount);

            if (address(pool.lpToken) == address(paws)) {
                totalPawsInPools = totalPawsInPools.add(_amount);
            }
        }

        user.rewardDebt = user.amount.mul(pool.accPawsPerShare).div(1e12);
    }

    // Withdraw tokens
    function withdraw(uint256 _pid, uint256 _amount) public nonReentrant {
        require(
            block.number >= startBlock,
            "PawsChef: Can not withdraw before start"
        );

        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];

        //this will make sure that user can only withdraw from his pool
        require(user.amount >= _amount, "Withdraw: User amount not enough");

        //Cannot withdraw more than pool's balance
        require(pool.totalLp >= _amount, "Withdraw: Pool total not enough");

        updatePool(_pid);

        payPendingPaws(_pid);
        payPendingAddRewards(_pid);

        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.totalLp = pool.totalLp.sub(_amount);
            if (address(pool.lpToken) == address(paws)) {
                totalPawsInPools = totalPawsInPools.sub(_amount);
            }
            if (isAddRewardPool(_pid)) {
                uint256 beforeWithdraw = pool.lpToken.balanceOf(address(this));
                IMasterChef(pool.addRewardChef).withdraw(
                    pool.addRewardChefPid,
                    _amount
                );
                uint256 afterWithdraw = pool.lpToken.balanceOf(address(this));
                _amount = afterWithdraw.sub(beforeWithdraw);

                pool.lpToken.safeTransfer(_msgSender(), _amount);
            } else {
                pool.lpToken.safeTransfer(_msgSender(), _amount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accPawsPerShare).div(1e12);
        emit Withdraw(_msgSender(), _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) public nonReentrant {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];
        uint256 amount = user.amount;

        //Cannot withdraw more than pool's balance
        require(
            pool.totalLp >= amount,
            "EmergencyWithdraw: Pool total not enough"
        );

        user.amount = 0;
        user.rewardDebt = 0;
        pool.totalLp = pool.totalLp.sub(amount);

        if (address(pool.lpToken) == address(paws)) {
            totalPawsInPools = totalPawsInPools.sub(amount);
        }
        if (isAddRewardPool(_pid)) {
            uint256 beforeWithdraw = pool.lpToken.balanceOf(address(this));
            IMasterChef(pool.addRewardChef).withdraw(
                pool.addRewardChefPid,
                amount
            );
            uint256 afterWithdraw = pool.lpToken.balanceOf(address(this));
            amount = afterWithdraw.sub(beforeWithdraw);

            pool.lpToken.safeTransfer(_msgSender(), amount);
        } else {
            pool.lpToken.safeTransfer(_msgSender(), amount);
        }

        emit EmergencyWithdraw(_msgSender(), _pid, amount);
    }

    // Pay pending Paws.
    function payPendingPaws(uint256 _pid) internal {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_msgSender()];

        uint256 pending = user.amount.mul(pool.accPawsPerShare).div(1e12).sub(
            user.rewardDebt
        );
        if (pending > 0) {
            // send rewards
            safePawsTransfer(_msgSender(), pending);
        }
    }

    function payPendingAddRewards(uint256 _pid) internal {
        if (isAddRewardPool(_pid)) {
            PoolInfo storage pool = poolInfo[_pid];
            UserInfo storage user = userInfo[_pid][_msgSender()];
            uint256 share = user.amount.mul(1e12).div(pool.totalLp);
            uint256 bal = IERC20(pool.addRewardToken).balanceOf(address(this));
            uint256 amount = share.mul(bal).div(1e12);
            IERC20(pool.addRewardToken).safeTransfer(_msgSender(), amount);
        }
    }

    // Safe Paws transfer function, just in case if rounding error causes pool do not have enough Paws.
    function safePawsTransfer(address _to, uint256 _amount) internal {
        if (paws.balanceOf(address(this)) > totalPawsInPools) {
            //PawsBal = total Paws in PawsChef - total Paws in Paws pools, this will make sure that PawsChef never transfer rewards from deposited Paws pools
            uint256 pawsBal = paws.balanceOf(address(this)).sub(
                totalPawsInPools
            );
            if (_amount >= pawsBal) {
                paws.transfer(_to, pawsBal);
            } else if (_amount > 0) {
                paws.transfer(_to, _amount);
            }
        }
    }

    function setFeeAddress(address _feeAddress) public {
        require(_msgSender() == feeAddress, "setFeeAddress: FORBIDDEN");
        require(_feeAddress != address(0), "setFeeAddress: ZERO");

        emit FeeAddressChanged(_msgSender(), feeAddress, _feeAddress);

        feeAddress = _feeAddress;
    }

    // Pancake has to add hidden dummy pools in order to alter the emission, here we make it simple and transparent to all.
    function updateEmissionRate(uint256 _pawsPerBlock) public onlyOperator {
        massUpdatePools();

        emit EmissionRateUpdated(msg.sender, pawsPerBlock, _pawsPerBlock);
        pawsPerBlock = _pawsPerBlock;
    }

    function updateAllocPoint(
        uint256 _pid,
        uint256 _allocPoint,
        bool _withUpdate
    ) public onlyOperator {
        if (_withUpdate) {
            massUpdatePools();
        }

        emit AllocPointsUpdated(
            _msgSender(),
            poolInfo[_pid].allocPoint,
            _allocPoint
        );

        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
    }

    function isAddRewardPool(uint256 _pid) public view returns (bool) {
        PoolInfo storage pool = poolInfo[_pid];
        return
            pool.addRewardChef != address(0x0) &&
            pool.addRewardToken != address(0x0) &&
            pool.addRewardChefPid >= 0;
    }
}
