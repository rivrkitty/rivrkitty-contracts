const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// Moonbase alpha
// const chefAddress = "0x364de9a286bEcd1848Ee7D670431eb0fEC0596D3";

// Moonriver
const chefAddress = "0x995ef3a5D14b66Ac5C7Fa1a967F8D9Cd727452bA";

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
