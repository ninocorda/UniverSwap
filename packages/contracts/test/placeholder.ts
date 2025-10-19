import { expect } from 'chai';
import { ethers } from 'hardhat';

describe('FeeManager', () => {
  it('splits ETH without reverting', async () => {
    const [deployer, user] = await ethers.getSigners();
    const FeeManager = await ethers.getContractFactory('FeeManager');
    const fm = await FeeManager.deploy(deployer.address);
    await fm.waitForDeployment();
    await expect(
      user.sendTransaction({ to: await fm.getAddress(), value: ethers.parseEther('1') })
    ).to.not.be.reverted;
  });
});
