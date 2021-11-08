const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("LPMigrator", function () {
  let factory = null;
  let signer = null;

  beforeEach(async function () {
    signer = await ethers.getSigner();
    console.log(signer.address);
    const Factory = await ethers.getContractFactory("Factory");
    factory = await Factory.deploy(
      "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",
      signer.address,
      0,
      {
        value: ethers.utils.parseUnits("0.1", "ether"),
      }
    );
    await factory.deployed();
  });

  it("Should change to new router", async function () {
    const migratorAddress = await factory.migrator();
    const migrator = await new ethers.Contract(
      migratorAddress,
      require("../abis/LPMigrator.json"),
      signer
    );

    await migrator.proposeRouter("0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F");

    await migrator.upgradeRouter();

    expect(await migrator.router()).to.equal(
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F"
    );
  });
});
