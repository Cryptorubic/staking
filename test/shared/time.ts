import { providers } from 'ethers';

type TimeSetterFunction = (timestamp: number) => Promise<void>;

type TimeSetters = {
    set: TimeSetterFunction;
    step: TimeSetterFunction;
    setAndMine: TimeSetterFunction;
};

export const createTimeMachine = (provider: providers.JsonRpcProvider): TimeSetters => {
    return {
        set: async (timestamp: number) => {
            // Not sure if I need both of those
            await provider.send('evm_setNextBlockTimestamp', [timestamp]);
        },

        step: async (interval: number) => {
            await provider.send('evm_increaseTime', [interval]);
        },

        setAndMine: async (timestamp: number) => {
            await provider.send('evm_setNextBlockTimestamp', [timestamp]);
            await provider.send('evm_mine', []);
        }
    };
};
