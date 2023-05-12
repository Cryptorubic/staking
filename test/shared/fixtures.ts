import { Wallet } from 'ethers';
import { ethers } from 'hardhat';
import { BNe18 } from './index';

import { RubicStaking, TestERC20 } from '../../typechain';
import { ActorFixture } from './actors';

export type StakingFixtureType = {
    staking: RubicStaking;
    RBC: TestERC20;
};

export const stakingFixture: () => Promise<StakingFixtureType> = async () => {
    const wallets = (await ethers.getSigners()) as any as Wallet[];
    const signer = new ActorFixture(wallets, ethers.provider).deployer();
    const user1 = new ActorFixture(wallets, ethers.provider).user1();
    const user2 = new ActorFixture(wallets, ethers.provider).user2();
    const tokenFactory = await ethers.getContractFactory('TestERC20', signer);
    const tokens = (await Promise.all([
        tokenFactory.deploy(), // do not use maxu256 to avoid overflowing
        tokenFactory.deploy()
    ])) as [TestERC20, TestERC20];
    await tokens[0].transfer(user1.address, BNe18(100));
    await tokens[0].transfer(user2.address, BNe18(100));
    const stakingFactory = await ethers.getContractFactory('RubicStaking', signer);
    const staking = (await stakingFactory.deploy(tokens[0].address)) as RubicStaking;
    await tokens[0].connect(user1).approve(staking.address, BNe18(10000));
    await tokens[0].connect(user2).approve(staking.address, BNe18(10000));
    await tokens[0].connect(signer).approve(staking.address, BNe18(100000));

    return {
        staking: staking,
        RBC: tokens[0]
    };
};
