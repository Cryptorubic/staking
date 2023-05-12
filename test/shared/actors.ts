import { Wallet } from 'ethers';

export const WALLET_USER_INDEXES = {
    deployer: 0,
    user1: 1,
    user2: 2,
    user3: 3
};

export class ActorFixture {
    wallets: Array<Wallet>;
    provider: any;

    constructor(wallets: Array<Wallet>, provider: any) {
        this.wallets = wallets;
        this.provider = provider;
    }
    /** EOA that owns all Rubic-related contracts */

    /** EOA that mints and transfers WETH to test accounts */
    deployer() {
        return this._getActor(WALLET_USER_INDEXES.deployer);
    }

    /** EOA that mints all the Test ERC20s we use */
    user1() {
        return this._getActor(WALLET_USER_INDEXES.user1);
    }

    user2() {
        return this._getActor(WALLET_USER_INDEXES.user2);
    }

    /** EOA that will deploy the tokenomics */
    user3() {
        return this._getActor(WALLET_USER_INDEXES.user3);
    }

    private _getActor(index: number): Wallet {
        /** Actual logic for fetching the wallet */
        const account = this.wallets[index];
        if (!account) {
            throw new Error(`Account ID ${index} could not be loaded`);
        }
        return account;
    }
}
