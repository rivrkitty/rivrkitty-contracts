const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// moonbaseAlpha
const chefAddress = "0x995ef3a5D14b66Ac5C7Fa1a967F8D9Cd727452bA";

const deployArgs = {
  allocPoint: 500,
  lpToken: "0x8e643094fb9941e273C2190563D7c514D56c841B",
  depositFeeBP: 0,
  withUpdate: false,
};

const poolInfo = {
  platform: "Huckleberry",
  platformUrl: "https://www.huckleberry.finance/#/swap",
  chefAddress: chefAddress,
  tokenAddress: deployArgs["lpToken"],
  buyTokenUrl: "https://www.huckleberry.finance/",
  rewardTokensDecimals: [18],
};

async function getTokenSymbol(tokenAddress, signer) {
  const token = await new ethers.Contract(
    tokenAddress,
    require("../artifacts/@openzeppelin/contracts/token/ERC20/ERC20.sol/ERC20.json")[
      "abi"
    ],
    signer
  );
  return await token.symbol();
}

async function updatePoolInfo(chef, signer) {
  const token = await new ethers.Contract(
    poolInfo["tokenAddress"],
    require("../artifacts/contracts/interfaces/IUniswapV2Pair.sol/IUniswapV2Pair.json")[
      "abi"
    ],
    signer
  );
  poolInfo["tokenName"] = await token.name();
  poolInfo["tokenDecimals"] = await token.decimals();
  poolInfo["poolId"] = (await chef.poolLength()).toNumber();
  const token0Address = await token.token0();
  const token1Address = await token.token1();
  const token0Symbol = await getTokenSymbol(token0Address, signer);
  const token1Symbol = await getTokenSymbol(token1Address, signer);
  poolInfo["tokenAssets"] = [token0Symbol, token1Symbol];
  poolInfo["tokenAssetAddresses"] = [token0Address, token0Address];
  poolInfo["id"] = `${
    poolInfo["platform".toLowerCase()]
  }-${token0Symbol.toLowerCase()}-${token1Symbol.toLowerCase()}`;
  poolInfo["name"] = `${token0Symbol}-${token1Symbol}`;
  poolInfo["buyTokenUrl"] += `#/add/${token0Address}/${token1Address}`;
  const rewardAddress = await chef.paws();
  poolInfo["rewardTokens"] = [await getTokenSymbol(rewardAddress, signer)];
  poolInfo["rewardTokensAddress"] = [rewardAddress];
}

async function main() {
  await hardhat.run("compile");

  const signer = await ethers.getSigner();

  const chef = await new ethers.Contract(
    chefAddress,
    require("../artifacts/contracts/PawsChef.sol/PawsChef.json")["abi"],
    signer
  );
  await updatePoolInfo(chef, signer);

  console.log("Deploying...", signer.address);

  console.log("deployArgs", deployArgs);
  await chef.add(...Object.values(deployArgs));

  // Update this before adding
  console.log("Created pool", poolInfo);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
