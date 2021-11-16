const { BigNumber } = require("@ethersproject/bignumber");
const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");
const { timeTravel } = require("./utils");

const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

describe("PawsChef", function () {
  beforeEach(async function () {
    const result = await ethers.getSigners();
    this.signer = result[0];
    this.otherAccount = result[1];

    const RivrKitty = await ethers.getContractFactory("RivrKitty");
    this.kitty = await RivrKitty.deploy(this.signer.address);
    await this.kitty.deployed();

    const KittyPaws = await ethers.getContractFactory("KittyPaws");
    this.paws = await KittyPaws.deploy();
    await this.paws.deployed();

    const PawsChef = await ethers.getContractFactory("PawsChef");
    this.chef = await PawsChef.deploy(
      this.paws.address,
      ethers.BigNumber.from(10).pow(10)
    );
    await this.chef.deployed();

    await this.paws.transferOwnership(this.chef.address);

    this.router = await new ethers.Contract(
      routerAddress,
      (
        await artifacts.readArtifact("IUniswapV2Router02")
      ).abi,
      this.signer
    );

    const factoryAddress = await this.router.factory();
    const factory = await new ethers.Contract(
      factoryAddress,
      (
        await artifacts.readArtifact("IUniswapV2Factory")
      ).abi,
      this.signer
    );

    const bal = await this.kitty.balanceOf(this.signer.address);
    await this.kitty.approve(
      this.router.address,
      ethers.utils.parseUnits("1", 30)
    );
    await this.router.addLiquidityETH(
      this.kitty.address,
      bal.div(3),
      1,
      1,
      this.signer.address,
      Math.round(new Date().getTime() / 1000) + 100,
      { value: 10 }
    );

    this.kitty.transfer(this.otherAccount.address, bal.div(5));
    await this.kitty
      .connect(this.otherAccount)
      .approve(this.router.address, ethers.utils.parseUnits("1", 30));
    await this.router
      .connect(this.otherAccount)
      .addLiquidityETH(
        this.kitty.address,
        await this.kitty.balanceOf(this.otherAccount.address),
        1,
        1,
        this.otherAccount.address,
        Math.round(new Date().getTime() / 1000) + 100,
        { value: 15 }
      );

    this.lpAddress = await factory.getPair(
      this.kitty.address,
      await this.router.WETH()
    );
    this.lp = await new ethers.Contract(
      this.lpAddress,
      (
        await artifacts.readArtifact("IUniswapV2Pair")
      ).abi,
      this.signer
    );
  });

  describe("Additional rewards", async function () {
    beforeEach(async function () {
      const Reward = await ethers.getContractFactory("KittyPaws");
      this.addRewardToken = await Reward.deploy();
      await this.addRewardToken.deployed();

      const RewardChef = await ethers.getContractFactory("PawsChef");
      this.rewardChef = await RewardChef.deploy(
        this.addRewardToken.address,
        ethers.BigNumber.from(10).pow(10)
      );
      await this.rewardChef.deployed();

      await this.addRewardToken.transferOwnership(this.rewardChef.address);

      await this.rewardChef.add(100, this.lp.address, 0, false);

      await this.chef.addWithAddReward(
        100,
        this.lp.address,
        0,
        false,
        this.rewardChef.address,
        0,
        this.addRewardToken.address
      );

      await this.chef.startFarming();
      await this.rewardChef.startFarming();

      this.balFirst = await this.lp.balanceOf(this.signer.address);
      this.balSecond = await this.lp.balanceOf(this.otherAccount.address);

      await this.lp.approve(this.chef.address, this.balFirst);
      await this.lp
        .connect(this.otherAccount)
        .approve(this.chef.address, this.balSecond);
    });

    it("should correctly return funds", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        ethers.BigNumber.from(0)
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        ethers.BigNumber.from(0)
      );

      await this.chef.withdraw(0, this.balFirst);
      await this.chef.connect(this.otherAccount).withdraw(0, this.balSecond);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        this.balFirst
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        this.balSecond
      );
    });

    it("should get double rewards", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);

      expect(this.balFirst.toNumber()).to.be.greaterThan(
        this.balSecond.toNumber()
      );

      const expectedPaws1 = await this.chef.pendingReward(
        0,
        this.signer.address
      );
      const expectedPaws2 = await this.chef.pendingReward(
        0,
        this.otherAccount.address
      );
      const expectedAddRewards = await this.rewardChef.pendingReward(
        0,
        this.chef.address
      );
      expect(expectedPaws1.toNumber()).to.not.equal(ethers.BigNumber.from(0));
      expect(expectedAddRewards.toNumber()).to.be.greaterThan(0);
      expect(expectedPaws2.toNumber()).to.not.equal(ethers.BigNumber.from(0));
      expect(expectedPaws1.toNumber()).to.be.greaterThan(
        expectedPaws2.toNumber()
      );

      await this.chef.deposit(0, 0);
      await this.chef.connect(this.otherAccount).deposit(0, 0);

      const receivedPaws1 = await this.paws.balanceOf(this.signer.address);
      const receivedPaws2 = await this.paws.balanceOf(
        this.otherAccount.address
      );
      const receivedAddRewards1 = await this.addRewardToken.balanceOf(
        this.signer.address
      );
      const receivedAddRewards2 = await this.addRewardToken.balanceOf(
        this.otherAccount.address
      );
      expect(receivedPaws1.toNumber()).to.be.greaterThan(
        expectedPaws1.toNumber()
      );
      expect(receivedAddRewards1.toNumber()).to.be.greaterThan(0);
      expect(receivedPaws2.toNumber()).to.be.greaterThan(
        expectedPaws2.toNumber()
      );
      expect(receivedAddRewards2.toNumber()).to.be.greaterThan(0);
      expect(receivedPaws1.toNumber()).to.be.greaterThan(
        receivedPaws2.toNumber()
      );
      expect(receivedAddRewards1.toNumber()).to.be.greaterThan(
        receivedAddRewards2.toNumber()
      );
    });

    it("should not take too much rewards", async function () {
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await this.chef.deposit(0, this.balFirst);
      await timeTravel(ethers, 2);
      await this.chef.withdraw(0, 0);
      await this.chef.connect(this.otherAccount).withdraw(0, 0);
      await this.chef.withdraw(0, this.balFirst);
      await this.chef.connect(this.otherAccount).withdraw(0, this.balSecond);

      const receivedPaws1 = await this.paws.balanceOf(this.signer.address);
      const receivedPaws2 = await this.paws.balanceOf(
        this.otherAccount.address
      );
      expect(receivedPaws2.toNumber()).to.be.greaterThan(
        receivedPaws1.toNumber()
      );
      const receivedAddRewards1 = await this.addRewardToken.balanceOf(
        this.signer.address
      );
      const receivedAddRewards2 = await this.addRewardToken.balanceOf(
        this.otherAccount.address
      );
      expect(receivedAddRewards2.toNumber()).to.be.greaterThan(
        receivedAddRewards1.toNumber()
      );
    });

    it("should emergency withdraw", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);

      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);

      await this.chef.emergencyWithdraw(0);
      await this.chef.connect(this.otherAccount).emergencyWithdraw(0);

      const receivedPaws1 = await this.paws.balanceOf(this.signer.address);
      const receivedPaws2 = await this.paws.balanceOf(
        this.otherAccount.address
      );
      const receivedAddRewards1 = await this.addRewardToken.balanceOf(
        this.signer.address
      );
      const receivedAddRewards2 = await this.addRewardToken.balanceOf(
        this.otherAccount.address
      );

      expect(receivedPaws1.toNumber()).to.equal(0);
      expect(receivedAddRewards1.toNumber()).to.equal(0);
      expect(receivedPaws2.toNumber()).to.equal(0);
      expect(receivedAddRewards2.toNumber()).to.equal(0);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        this.balFirst
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        this.balSecond
      );
    });

    it("should calculate additional rewards via calc", async function () {
      const AdditionalRewardCalc = await ethers.getContractFactory(
        "AdditionalRewardCalc"
      );
      const calc = await AdditionalRewardCalc.deploy();
      await calc.deployed();

      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);

      expect(
        await calc.pendingRewards(this.chef.address, 0, this.signer.address)
      ).to.not.equal(ethers.BigNumber.from(0));
    });
  });

  describe("Single rewards", async function () {
    beforeEach(async function () {
      await this.chef.add(100, this.lp.address, 0, false);

      await this.chef.startFarming();

      this.balFirst = await this.lp.balanceOf(this.signer.address);
      this.balSecond = await this.lp.balanceOf(this.otherAccount.address);

      await this.lp.approve(this.chef.address, this.balFirst);
      await this.lp
        .connect(this.otherAccount)
        .approve(this.chef.address, this.balSecond);
    });

    it("should correctly return funds", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        ethers.BigNumber.from(0)
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        ethers.BigNumber.from(0)
      );

      await this.chef.withdraw(0, this.balFirst);
      await this.chef.connect(this.otherAccount).withdraw(0, this.balSecond);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        this.balFirst
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        this.balSecond
      );
    });

    it("should get rewards", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);

      expect(this.balFirst.toNumber()).to.be.greaterThan(
        this.balSecond.toNumber()
      );

      const expectedPaws1 = await this.chef.pendingReward(
        0,
        this.signer.address
      );
      const expectedPaws2 = await this.chef.pendingReward(
        0,
        this.otherAccount.address
      );
      expect(expectedPaws1.toNumber()).to.not.equal(ethers.BigNumber.from(0));
      expect(expectedPaws2.toNumber()).to.not.equal(ethers.BigNumber.from(0));
      expect(expectedPaws1.toNumber()).to.be.greaterThan(
        expectedPaws2.toNumber()
      );

      await this.chef.deposit(0, 0);
      await this.chef.connect(this.otherAccount).deposit(0, 0);

      const receivedPaws1 = await this.paws.balanceOf(this.signer.address);
      const receivedPaws2 = await this.paws.balanceOf(
        this.otherAccount.address
      );
      expect(receivedPaws1.toNumber()).to.be.greaterThan(
        expectedPaws1.toNumber()
      );
      expect(receivedPaws2.toNumber()).to.be.greaterThan(
        expectedPaws2.toNumber()
      );
      expect(receivedPaws1.toNumber()).to.be.greaterThan(
        receivedPaws2.toNumber()
      );
    });

    it("should emergency withdraw", async function () {
      await this.chef.deposit(0, this.balFirst);
      await this.chef.connect(this.otherAccount).deposit(0, this.balSecond);

      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);
      await timeTravel(ethers, 2);

      await this.chef.emergencyWithdraw(0);
      await this.chef.connect(this.otherAccount).emergencyWithdraw(0);

      const receivedPaws1 = await this.paws.balanceOf(this.signer.address);
      const receivedPaws2 = await this.paws.balanceOf(
        this.otherAccount.address
      );

      expect(receivedPaws1.toNumber()).to.equal(0);
      expect(receivedPaws2.toNumber()).to.equal(0);

      expect(await this.lp.balanceOf(this.signer.address)).to.equal(
        this.balFirst
      );
      expect(await this.lp.balanceOf(this.otherAccount.address)).to.equal(
        this.balSecond
      );
    });
  });
});
