const hardhat = require("hardhat");

const ethers = hardhat.ethers;

async function main() {
  await hardhat.run("compile");

  const signer = await ethers.getSigner();
  const ChefFactory = await ethers.getContractFactory("ChefFactory");

  console.log("Deploying...", signer.address);

  // const gasPrice = ethers.BigNumber.from("9000000000");
  const chefFactory = await ChefFactory.deploy(
    signer.address,
    signer.address
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
