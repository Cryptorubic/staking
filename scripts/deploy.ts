const hre = require('hardhat');
import { RubicStaking } from '../typechain';

async function main() {
    const factory = await hre.ethers.getContractFactory('RubicStaking');
    const contract = (await factory.deploy(
        '0x11887Ee906de64DaA8b905B419Bfeb6DEbAfBF34'
    )) as RubicStaking;

    await contract.deployed();

    console.log('Contract deployed to:', contract.address);

    await new Promise(r => setTimeout(r, 30000));

    await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments: ['0x11887Ee906de64DaA8b905B419Bfeb6DEbAfBF34']
    });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
