const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");

const day = 24 * 60 * 60;
const week = 7 * day;

describe("RivrKitty", function () {
  beforeEach(async function () {
    const result = await ethers.getSigners();
    this.signer = result[0];
    this.otherAccount = result[1];

    const RivrKitty = await ethers.getContractFactory("RivrKitty");
    this.kitty = await RivrKitty.deploy(this.signer.address);
  });

  it("Check constructor result", async function () {
    await this.kitty.deployed();

    const tokenAmount = ethers.utils.parseUnits("1", 12 + 18);
    const teamPart = tokenAmount.div(100);
    const lpPart = tokenAmount.mul(96).div(100);
    expect(await this.kitty.totalSupply()).to.equal(tokenAmount);

    expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
      teamPart.add(lpPart)
    );

    const startTime = await this.kitty.startTime();
    const self = this;

    async function testTimelock(address, timeout) {
      const timelock = new ethers.Contract(
        address,
        (await artifacts.readArtifact("TokenTimelock")).abi,
        self.signer
      );
      expect(await timelock.token()).to.equal(self.kitty.address);
      expect(await timelock.releaseTime()).to.equal(startTime.add(timeout));
      expect(await timelock.beneficiary()).to.equal(self.signer.address);
      expect(await self.kitty.balanceOf(address)).to.equal(teamPart);
    }

    await testTimelock(await this.kitty.firstTimelockAddress(), 4 * week);
    await testTimelock(await this.kitty.secondTimelockAddress(), 8 * week);
    await testTimelock(await this.kitty.thirdTimelockAddress(), 12 * week);
  });

  describe("Anti whale", async function () {
    it("Transfer success without", async function () {
      await this.kitty.deployed();

      const totalSupply = await this.kitty.totalSupply();
      await this.kitty
        .connect(this.signer)
        .transfer(this.otherAccount.address, totalSupply.mul(5).div(100));
      expect(await this.kitty.balanceOf(this.otherAccount.address)).to.equal(
        totalSupply.mul(5).div(100)
      );
    });

    it("Transfer failure with", async function () {
      await this.kitty.deployed();
      await this.kitty.enableWhaleBlocking();

      const totalSupply = await this.kitty.totalSupply();
      const transfer = this.kitty
        .connect(this.signer)
        .transfer(
          this.otherAccount.address,
          totalSupply.mul(3).div(100).add(1)
        );
      await expect(transfer).to.revertedWith("!whale reject");
    });

    it("Transfer success with", async function () {
      await this.kitty.deployed();
      await this.kitty.enableWhaleBlocking();

      const totalSupply = await this.kitty.totalSupply();
      await this.kitty
        .connect(this.signer)
        .transfer(this.otherAccount.address, totalSupply.mul(3).div(100));
      expect(await this.kitty.balanceOf(this.otherAccount.address)).to.equal(
        totalSupply.mul(3).div(100)
      );
    });
    it("Transfer success with after 7 days", async function () {
      await ethers.provider.send("evm_increaseTime", [7 * day]);

      await this.kitty.deployed();
      await this.kitty.enableWhaleBlocking();

      const totalSupply = await this.kitty.totalSupply();
      await this.kitty
        .connect(this.signer)
        .transfer(this.otherAccount.address, totalSupply.mul(5).div(100));
      expect(await this.kitty.balanceOf(this.otherAccount.address)).to.equal(
        totalSupply.mul(5).div(100)
      );
    });
  });

  describe("Team timelocks", async function () {
    beforeEach(async function () {
      this.currentBal = await this.kitty.balanceOf(this.signer.address);
      this.partAmount = (await this.kitty.totalSupply()).div(100);
    });

    async function release(address) {
      const abi = (await artifacts.readArtifact("TokenTimelock")).abi;
      const timelock = await new ethers.Contract(
        address,
        abi,
        await ethers.getSigner()
      );
      return timelock.release();
    }

    it("Cannot release all locks", async function () {
      await expect(
        release(await this.kitty.firstTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");

      await expect(
        release(await this.kitty.secondTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");

      await expect(
        release(await this.kitty.thirdTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");
    });

    it("One can be relase after one month", async function () {
      await ethers.provider.send("evm_increaseTime", [4 * week]);

      await release(await this.kitty.firstTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount)
      );

      await expect(
        release(await this.kitty.secondTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");

      await expect(
        release(await this.kitty.thirdTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");
    });

    it("One can be relase after two months", async function () {
      await ethers.provider.send("evm_increaseTime", [8 * week]);

      await release(await this.kitty.firstTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount)
      );

      await release(await this.kitty.secondTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount.mul(2))
      );

      await expect(
        release(await this.kitty.thirdTimelockAddress())
      ).to.revertedWith("TokenTimelock: current time is before release time");
    });

    it("One can be relase after three months", async function () {
      await ethers.provider.send("evm_increaseTime", [12 * week]);

      await release(await this.kitty.firstTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount)
      );

      await release(await this.kitty.secondTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount.mul(2))
      );

      await release(await this.kitty.thirdTimelockAddress());
      expect(await this.kitty.balanceOf(this.signer.address)).to.equal(
        this.currentBal.add(this.partAmount.mul(3))
      );
    });
  });
});
