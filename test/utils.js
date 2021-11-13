const timeTravel = async (ethers, seconds) => {
  await ethers.provider.send("evm_increaseTime", [seconds]);
  await ethers.provider.send("evm_mine");
};

module.exports = { timeTravel };
