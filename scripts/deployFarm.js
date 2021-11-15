const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// TODO: uncomment when releasing
// const multisigAddress = "0xF21A3A541C3c96100A7BFb9b249220cdB631907d";

async function main() {
  await hardhat.run("compile");

  const signer = await ethers.getSigner();
  const ChefFactory = await ethers.getContractFactory("ChefFactory");
  const multisigAddress = signer.address;

  console.log("Deploying...", multisigAddress);

  // const gasPrice = ethers.BigNumber.from("9000000000");
  const chefFactory = await ChefFactory.deploy(
    multisigAddress,
    multisigAddress
    // {
    //   // gasPrice,
    // }
  );

  console.log("Waiting for confirmation...");
  await chefFactory.deployed();

  console.log("Factory deployed to:", chefFactory.address);
  console.log("Paws Token address:", await chefFactory.paws());
  console.log("Chef address:", await chefFactory.chef());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
