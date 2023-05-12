import { BigNumber, BigNumberish } from 'ethers';
import { provider } from './provider';

export const blockTimestamp = async () => {
    const block = await provider.getBlock('latest');
    if (!block) {
        throw new Error('null block returned from provider');
    }
    return block.timestamp;
};

export const BN = BigNumber.from;
export const BNe = (n: BigNumberish, exponent: BigNumberish) => BN(n).mul(BN(10).pow(exponent));
export const BNe18 = (n: BigNumberish) => BNe(n, 18);