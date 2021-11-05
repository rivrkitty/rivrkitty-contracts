const hardhat = require("hardhat");

const ethers = hardhat.ethers;

const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";

async function main() {
  await hardhat.run("compile");

  const Factory = await ethers.getContractFactory("Factory");

  const factory = await Factory.deploy(UNISWAP_ROUTER, {
    value: ethers.utils.parseUnits("0.001", "ether"),
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
