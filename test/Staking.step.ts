import { ethers } from 'hardhat';
import { BigNumber, Wallet } from 'ethers';

import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import { stakingFixture, StakingFixtureType } from './shared/fixtures';
import { blockTimestamp, BNe18 } from './shared/index';
import { ActorFixture } from './shared/actors';
import { provider } from './shared/provider';
import { createTimeMachine } from './shared/time';
import { expect } from 'chai';
import { beforeEach } from 'mocha';

const { balance } = require('@openzeppelin/test-helpers');

describe('unit/Staking', () => {
    let actors: ActorFixture;
    let deployer: Wallet;
    let user1: Wallet;
    let user2: Wallet;
    let context: StakingFixtureType;
    const Time = createTimeMachine(provider);

    before(async () => {
        const wallets = (await ethers.getSigners()) as any as Wallet[];
        actors = new ActorFixture(wallets, provider);
        deployer = actors.deployer();
        user1 = actors.user1();
        user2 = actors.user2();
    });

    beforeEach('create fixture loader', async () => {
        context = await loadFixture(stakingFixture);
    });

    describe('#stake', () => {
        it('stake fields is correct', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 15552000; //180 days
            let amount = BNe18(20);
            await context.staking.connect(user1).enterStaking(amount, lockTime);

            let stake = await context.staking.stakes('1');
            expect(await context.RBC.balanceOf(context.staking.address)).to.eq(amount);
            expect(stake.lockStartTime).to.eq(startTime + 1);
            expect(stake.lockTime).to.eq(lockTime);
            expect(stake.amount).to.eq(amount);
            expect(stake.lastRewardGrowth).to.eq(1);
        });

        it('rewardGrowth after added rewards is correct', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 23328000;
            let amount = BNe18(20);
            await context.staking.connect(user1).enterStaking(amount, lockTime);
            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.connect(deployer).setRate(BNe18(1));

            Time.set(startTime + lockTime);

            await context.staking.connect(user2).enterStaking(amount, lockTime);

            let stake = await context.staking.stakes('2');
            expect(stake.lockTime).to.eq(lockTime);
            expect(stake.amount).to.eq(amount);
            expect(stake.lastRewardGrowth).to.eq(BigNumber.from('33333333333333333333333333334'));
        });

        it('fails if amount is 0', async () => {
            let lockTime = 15552000;
            let amount = BNe18(0);
            await expect(
                context.staking.connect(user1).enterStaking(amount, lockTime)
            ).to.be.revertedWith('stake amount should be correct');
        });

        it('fails if lock period is incorrect', async () => {
            let lockTime = 200;
            let amount = BNe18(100);
            await expect(
                context.staking.connect(user1).enterStaking(amount, lockTime)
            ).to.be.revertedWith('incorrect lock');
        });
    });

    describe('#unstake', () => {
        it('get deposited tokens and rewards', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 7776000; // 30
            const tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();

            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(1000) });

            await context.staking.connect(deployer).setRate(BNe18(1));

            Time.set(startTime + lockTime + 10000);

            await context.staking.connect(user1).unstake('1');
            const { delta, fees } = await tracker.deltaWithFees();
            expect(delta.add(fees)).to.eq(BNe18(1000));
        });

        it('stake deleted correctly', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 7776000;
            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });

            Time.set(startTime + lockTime + 10);

            await context.staking.connect(user1).unstake('1');
            let stake = await context.staking.stakes('1');
            expect(stake.lockStartTime).to.eq(0);
            expect(stake.lockTime).to.eq(0);
            expect(stake.amount).to.eq(0);
            expect(stake.lastRewardGrowth).to.eq(0);
        });

        it('work correct after emergencyStop', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 7776000; // 30

            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(1000) });
            await context.staking.connect(deployer).setRate(BNe18(1));

            Time.set(startTime + 10000);
            await context.staking.connect(deployer).setEmergencyStop(true);
            let balanceBefore = await context.RBC.balanceOf(user1.address);
            await context.staking.connect(user1).unstake('1');
            let balanceAfter = await context.RBC.balanceOf(user1.address);
            expect(balanceAfter.sub(balanceBefore)).to.eq(BNe18(20));
        });

        it('work correct after emergencyStop(_increaseCumulative before)', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 7776000; // 30

            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(1000) });
            await context.staking.connect(deployer).setRate(BNe18(1));

            Time.set(startTime + 10000);

            await context.staking.connect(deployer).setRate(BNe18(1));
            await context.staking.connect(deployer).setEmergencyStop(true);

            let balanceBefore = await context.RBC.balanceOf(user1.address);
            const tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();

            await context.staking.connect(user1).unstake('1');

            let balanceAfter = await context.RBC.balanceOf(user1.address);
            const { delta, fees } = await tracker.deltaWithFees();

            expect(balanceAfter.sub(balanceBefore)).to.eq(BNe18(20));
            expect(delta.add(fees)).to.eq(BNe18(1000));
        });

        it('fails if unstake before lock end time', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 31104000; // year
            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });

            Time.set(startTime + lockTime - 100000);

            await expect(context.staking.connect(user1).unstake('1')).to.be.revertedWith(
                'lock isnt expired'
            );
        });

        it('fails if you are not the owner of the deposit', async () => {
            let startTime = await blockTimestamp();
            let lockTime = 31104000;

            await context.staking.connect(user1).enterStaking(BNe18(20), lockTime);
            await context.staking.connect(user2).enterStaking(BNe18(20), lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });

            Time.set(startTime + lockTime);

            await expect(context.staking.connect(user1).unstake('2')).to.be.revertedWith(
                'Not authorized'
            );
        });
    });

    describe('#claimRewards', () => {
        it('works corrects before lock end time', async () => {
            let startTime = await blockTimestamp();
            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);
            await context.staking.connect(user2).enterStaking(BNe18(10), 31104000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.connect(deployer).setRate(BNe18(1));

            Time.set(startTime + 200000);

            let tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();
            await context.staking.connect(user1).claimRewards('1');
            let { delta, fees } = await tracker.deltaWithFees();
            expect(delta.add(fees)).to.eq(BNe18(5));

            tracker = await balance.tracker(user2.address); // instantiation
            await tracker.get();
            await context.staking.connect(user2).claimRewards('2');
            ({ delta, fees } = await tracker.deltaWithFees());
            expect(delta.add(fees)).to.eq(BNe18(5));
        });

        it('works corrects after lock end time', async () => {
            let startTime = await blockTimestamp();

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);
            await context.staking.connect(user2).enterStaking(BNe18(10), 31104000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.connect(deployer).setRate(BNe18(1));

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);

            Time.set(startTime + 23338000);

            const tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();
            await context.staking.connect(user1).claimRewards('3'); // (10 - 1) / 3
            const { delta, fees } = await tracker.deltaWithFees();
            expect(delta.add(fees)).to.eq(BNe18(3));
        });
    });

    describe('#sweep', () => {
        it('can sweep', async () => {
            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.sweepTokens(
                ethers.constants.AddressZero,
                '0x11887Ee906de64DaA8b905B419Bfeb6DEbAfBF34',
                BNe18(10)
            );
            expect(
                await ethers.provider.getBalance('0x11887Ee906de64DaA8b905B419Bfeb6DEbAfBF34')
            ).to.be.eq(BNe18(10));
        });
        it('reward reserve after sweep of native is decreased', async () => {
            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.sweepTokens(
                ethers.constants.AddressZero,
                '0x11887Ee906de64DaA8b905B419Bfeb6DEbAfBF34',
                BNe18(6)
            );
            expect(await context.staking.rewardReserve()).to.be.eq(BNe18(4));
        });
    });

    describe('rewards distribution', () => {
        it('stake ', async () => {
            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);
            await context.staking.connect(user2).enterStaking(BNe18(10), 15552000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(100) });
            await context.staking.connect(deployer).setRate(BNe18(1));
            let startTime = await blockTimestamp();

            Time.set(startTime + 10);

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);

            Time.set(startTime + 100);

            await mine();

            expect(await context.staking.calculateRewards('1')).to.eq('40865384615384615384');
            expect(await context.staking.calculateRewards('2')).to.eq('24519230769230769230');
            expect(await context.staking.calculateRewards('3')).to.eq('34615384615384615384');
        });

        it('is correct', async () => {
            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);
            await context.staking.connect(user2).enterStaking(BNe18(10), 15552000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(100) });
            await context.staking.connect(deployer).setRate(BNe18(1));
            let startTime = await blockTimestamp();

            Time.set(startTime + 200);

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(70) });
            await context.staking.connect(deployer).setRate(BNe18(2));

            Time.set(startTime + 400);

            await context.RBC.connect(user1).transfer(user2.address, BNe18(1));

            expect(await context.staking.calculateRewards('1')).to.eq('89423076923076923076');
            expect(await context.staking.calculateRewards('2')).to.eq('53653846153846153846');
            expect(await context.staking.calculateRewards('3')).to.eq('26923076923076923076');
        });

        it('is correct', async () => {
            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);
            await context.staking.connect(user2).enterStaking(BNe18(10), 15552000);

            await context.staking.connect(deployer).setRate(BNe18(1));
            await context.staking.connect(deployer).addRewards({ value: BNe18(100) });
            await context.staking.connect(deployer).addRewards({ value: BNe18(100) });
            let startTime = await blockTimestamp();

            Time.set(startTime + 15552000);
            //
            // await context.RBC.connect(user1).transfer(user2.address, BNe18(1));

            await context.staking.connect(user1).unstake('1');
            await context.staking.connect(user2).unstake('2');

            await context.staking.connect(deployer).addRewards({ value: BNe18(200) });
            await context.staking.connect(deployer).addRewards({ value: BNe18(200) });

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);

            startTime = await blockTimestamp();

            Time.set(startTime + 7778000);

            await context.staking.connect(user2).enterStaking(BNe18(20), 7776000);

            let tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();
            await context.staking.connect(user1).claimRewards('3');
            let { delta, fees } = await tracker.deltaWithFees();
            expect(delta.add(fees)).to.eq(BNe18(400));
        });

        it('is correct', async () => {
            await context.staking.connect(deployer).addRewards({ value: BNe18(300) });

            await context.staking.connect(user1).enterStaking(BNe18(20), 7776000);

            await context.staking.connect(deployer).setRate(BNe18(1));
            let startTime = await blockTimestamp();

            Time.set(startTime + 100);

            await context.staking.connect(deployer).setRate(BNe18(3));

            expect(await context.staking.calculateRewards('1')).to.eq(BNe18(100));

            Time.set(startTime + 403);

            let tracker = await balance.tracker(user1.address); // instantiation
            await tracker.get();
            await context.staking.connect(user1).claimRewards('1');
            let { delta, fees } = await tracker.deltaWithFees();
            expect(delta.add(fees)).to.eq(BNe18(300));

            await context.staking.connect(user1).enterStaking(BNe18(20), 23328000);

            await context.staking.connect(deployer).addRewards({ value: BNe18(300) });

            Time.set(startTime + 1200);

            tracker = await balance.tracker(user1.address);
            await tracker.get();
            await context.staking.connect(user1).claimRewards('2');
            ({ delta, fees } = await tracker.deltaWithFees());
            expect(delta.add(fees)).to.eq(BNe18(180));
        });
    });

    describe('view functions', () => {
        beforeEach('setup', async () => {
            let lockTime = 15552000; //180 days
            let amount = BNe18(20);
            await context.staking.connect(user1).enterStaking(amount, lockTime);
            await context.staking.connect(user1).enterStaking(amount, lockTime);
            await context.staking.connect(user1).enterStaking(amount, lockTime);

            await context.staking.connect(deployer).addRewards({ value: BNe18(10) });
            await context.staking.connect(deployer).setRate(BNe18(1));
        });
        it('tokens of owner', async () => {
            expect(await context.staking.tokensOfOwner(user1.address)).to.deep.eq([1, 2, 3]);
        });
        it('tokens of owner after transfer', async () => {
            await context.staking.connect(user1).transferFrom(user1.address, user2.address, 2);
            expect(await context.staking.tokensOfOwner(user1.address)).to.deep.eq([1, 3]);
            expect(await context.staking.tokensOfOwner(user2.address)).to.deep.eq([2]);
        });
        it('annual rewards estimate', async () => {
            expect(await context.staking.estimatedAnnualRewardsByTokenId(1)).to.be.eq(
                BNe18(1)
                    .mul(365 * 24 * 60 * 60)
                    .div(3)
            );
        });
    });
});
