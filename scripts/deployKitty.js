const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// uniswap on ropsten
// const UNISWAP_ROUTER = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D";
// solar
const UNISWAP_ROUTER = "0xAA30eF758139ae4a7f798112902Bf6d65612045f";
// moonswap alpha
// const UNISWAP_ROUTER = "0xEA2097B1F1805294797f638A5767A5432D721FFf";
// huckleberry alpha
// const UNISWAP_ROUTER = "0x2d4e873f9Ab279da9f1bb2c532d4F06f67755b77";

async function main() {
  await hardhat.run("compile");

  const devAddress = (await ethers.getSigner()).address;

  const Factory = await ethers.getContractFactory("Factory");

  console.log("Deploying...");

  const factory = await Factory.deploy(UNISWAP_ROUTER, devAddress, 0, {
    value: ethers.utils.parseUnits("2", "ether"),
  });

  console.log("Waiting for confirmation...");
  await factory.deployed();

  console.log("Factory deployed to:", factory.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
