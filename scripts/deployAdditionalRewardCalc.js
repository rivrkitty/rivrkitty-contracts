const hardhat = require("hardhat");

const ethers = hardhat.ethers;

async function main() {
  await hardhat.run("compile");

  const AdditionalRewardCalc = await ethers.getContractFactory(
    "AdditionalRewardCalc"
  );

  console.log("Deploying...");

  const gasPrice = ethers.BigNumber.from("4000000000");
  const additionalRewardCalc = await AdditionalRewardCalc.deploy({
    gasPrice,
  });

  console.log("Waiting for confirmation...");
  await additionalRewardCalc.deployed();

  console.log(
    "AdditionalRewardCalc deployed to:",
    additionalRewardCalc.address
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
