const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// Moonbase alpha
const chefAddress = "0x09B7435F39ef4c0c5E9faD4A2bf0Ae19999A7316";

async function main() {
  await hardhat.run("compile");

  const signer = await ethers.getSigner();

  const chef = await new ethers.Contract(
    chefAddress,
    require("../artifacts/contracts/PawsChef.sol/PawsChef.json")["abi"],
    signer
  );
  await chef.startFarming();
  console.log("Farming started");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
