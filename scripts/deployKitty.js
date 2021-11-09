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

const multisigAddress = "0xF21A3A541C3c96100A7BFb9b249220cdB631907d";

async function main() {
  await hardhat.run("compile");

  const Factory = await ethers.getContractFactory("Factory");

  console.log("Deploying...", (await ethers.getSigner()).address);

  const gasPrice = ethers.BigNumber.from("9000000000");
  const factory = await Factory.deploy(UNISWAP_ROUTER, multisigAddress, {
    value: ethers.utils.parseUnits("2", "ether"),
    gasPrice,
  });

  console.log("Waiting for confirmation...");
  await factory.deployed();

  console.log("Factory deployed to:", factory.address);
  console.log("Token address:", await factory.token());
  console.log("Migrator address:", await factory.migrator());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
