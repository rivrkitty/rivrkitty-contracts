const hardhat = require("hardhat");

const ethers = hardhat.ethers;

const SOLAR_ROUTER = "0xAA30eF758139ae4a7f798112902Bf6d65612045f";

async function main() {
  await hardhat.run("compile");

  const Factory = await ethers.getContractFactory("Factory");

  const factory = await Factory.deploy(SOLAR_ROUTER, {
    value: ethers.utils.parseUnits("2", "ether"),
  });
  await factory.deployed();

  console.log("Factory deployed to:", factory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
