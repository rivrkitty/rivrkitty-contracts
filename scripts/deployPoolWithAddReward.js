const hardhat = require("hardhat");

const ethers = hardhat.ethers;

// moonbaseAlpha
const chefAddress = "0x364de9a286bEcd1848Ee7D670431eb0fEC0596D3";
const huckleChef = "0xd45F54838dbfCe0F976bD430bE5f8678479E1510";
const finnAddress = "0x31b1644f8379a22d25f845a67f1ab346e76001aa";

// TODO: uncomment when releasing
// const multisigAddress = "0xF21A3A541C3c96100A7BFb9b249220cdB631907d";

const addRewardChefAddress = huckleChef;
const addRewardAddress = finnAddress;

const deployArgs = {
  allocPoint: 100,
  lpToken: "0x7d92ac7065371e0e4a201eae7a263cd8146d7ccc",
  depositFeeBP: 0,
  withUpdate: false,
  addRewardChef: addRewardChefAddress,
  addRewardChefPid: 7,
  addRewardToken: addRewardAddress,
};

const poolInfo = {
  platform: "Huckleberry",
  platformUrl: "https://www.huckleberry.finance/#/swap",
  chefAddress: chefAddress,
  tokenAddress: deployArgs["lpToken"],
  buyTokenUrl: "https://www.huckleberry.finance/",
  rewardTokensDecimals: [18, 18],
  addRewardChefAddress: deployArgs["addRewardChef"],
  addRewardChefPid: deployArgs["addRewardChefPid"],
  addRewardChefPerBlockName: "finnPerSecond",
  addRewardChefPerBlockType: "seconds",
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
  }-${token0Symbol.toLowerCase()}-${token1Symbol.toLowerCase()}-multi`;
  poolInfo["name"] = `${token0Symbol}-${token1Symbol}`;
  poolInfo["buyTokenUrl"] += `#/add/${token0Address}/${token1Address}`;
  const rewardAddress = await chef.paws();
  poolInfo["rewardTokens"] = [
    await getTokenSymbol(rewardAddress, signer),
    await getTokenSymbol(addRewardAddress, signer),
  ];
  poolInfo["rewardTokensAddress"] = [rewardAddress, addRewardAddress];
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
  await chef.addWithAddReward(...Object.values(deployArgs));

  // Update this before adding
  console.log("Created pool", poolInfo);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
