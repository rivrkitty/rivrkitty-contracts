require("@nomiclabs/hardhat-waffle");

const fs = require("fs");
const privateKey = fs.readFileSync(".secret").toString().trim();

module.exports = {
  solidity: {
    version: "0.8.7",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    },
  },
  networks: {
    moonriver: {
      url: "https://rpc.moonriver.moonbeam.network",
      chainId: 1285,
      accounts: [privateKey],
    },
    ropsten: {
      url: "https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161",
      chainId: 3,
      accounts: [privateKey],
    },
  },
};
