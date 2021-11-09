const { expect } = require("chai");
const { ethers, artifacts } = require("hardhat");

const day = 24 * 60 * 60;
const routerAddress = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

describe("Factory", function () {
  beforeEach(async function () {
    this.signer = await ethers.getSigner();
    this.otherAccount = (await ethers.getSigners())[1];
    const Factory = await ethers.getContractFactory("Factory");
    this.factory = await Factory.deploy(
      routerAddress,
      this.otherAccount.address,
      {
        value: ethers.utils.parseUnits("0.1", "ether"),
      }
    );
    await this.factory.deployed();
    this.kittyAddress = await this.factory.token();
    this.kitty = await new ethers.Contract(
      this.kittyAddress,
      (
        await artifacts.readArtifact("RivrKitty")
      ).abi,
      this.signer
    );
  });

  it("should enable whale blocking", async function () {
    expect(await this.kitty.whaleBlockingEnabled()).to.be.true;
  });

  it("should factory not have any tokens", async function () {
    expect(await this.kitty.balanceOf(this.factory.address)).to.equal(
      ethers.BigNumber.from(0)
    );
  });

  it("should other account have 1% of tokens", async function () {
    expect(await this.kitty.balanceOf(this.otherAccount.address)).to.equal(
      (await this.kitty.totalSupply()).div(100)
    );
  });

  describe("LPMigrator", async function () {
    beforeEach(async function () {
      this.migratorAddress = await this.factory.migrator();
      this.migrator = await new ethers.Contract(
        this.migratorAddress,
        (
          await artifacts.readArtifact("LPMigrator")
        ).abi,
        this.signer
      );
      this.router = await new ethers.Contract(
        routerAddress,
        (
          await artifacts.readArtifact("IUniswapV2Router02")
        ).abi,
        this.signer
      );
      this.routerFactory = await new ethers.Contract(
        await this.router.factory(),
        (
          await artifacts.readArtifact("IUniswapV2Factory")
        ).abi,
        this.signer
      );
    });

    it("should initialize liq & transfer ownership", async function () {
      expect(await this.migrator.owner()).to.equal(this.otherAccount.address);
      expect(await this.migrator.initialized()).to.equal(true);
      const lpAddress = await this.routerFactory.getPair(
        this.kittyAddress,
        await this.router.WETH()
      );
      const lp = await new ethers.Contract(
        lpAddress,
        (
          await artifacts.readArtifact("IERC20")
        ).abi,
        this.signer
      );
      expect(
        (await lp.balanceOf(this.migrator.address)).toString()
      ).to.not.equal("0");
    });

    it("should not change to new router because of timelock", async function () {
      // to pass whale block
      await ethers.provider.send("evm_increaseTime", [7 * day]);

      await this.migrator
        .connect(this.otherAccount)
        .proposeRouter("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
      expect((await this.migrator.routerCandidate()).router).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );

      await ethers.provider.send("evm_increaseTime", [2 * day]);

      await expect(
        this.migrator.connect(this.otherAccount).upgradeRouter()
      ).to.revertedWith("Delay has not passed");
    });

    it("should change to new router", async function () {
      // to pass whale block
      await ethers.provider.send("evm_increaseTime", [7 * day]);

      await this.migrator
        .connect(this.otherAccount)
        .proposeRouter("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");
      expect((await this.migrator.routerCandidate()).router).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );

      await ethers.provider.send("evm_increaseTime", [8 * day]);

      await this.migrator.connect(this.otherAccount).upgradeRouter();

      expect(await this.migrator.router()).to.equal(
        "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
      );
      expect((await this.migrator.routerCandidate()).router).to.equal(
        ethers.constants.AddressZero
      );
    });

    it("should not increate approval delay", async function () {
      await expect(
        this.migrator
          .connect(this.otherAccount)
          .increaseApprovalDelayTo(7 * day)
      ).to.revertedWith("!new approval delay smaller than old");
    });

    it("should increate approval delay", async function () {
      await this.migrator
        .connect(this.otherAccount)
        .increaseApprovalDelayTo(8 * day);
      expect(await this.migrator.approvalDelay()).to.equal(
        ethers.BigNumber.from(8 * day)
      );
    });
  });
});
