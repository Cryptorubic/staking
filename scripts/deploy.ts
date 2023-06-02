const hre = require('hardhat');
import { RubicStaking } from '../typechain';

async function main() {
    const constructorArguments = ['0x10aaed289a7b1b0155bf4b86c862f297e84465e0'];

    const factory = await hre.ethers.getContractFactory('RubicStaking');
    const contract = (await factory.deploy(...constructorArguments)) as RubicStaking;

    await contract.deployed();

    console.log('Contract deployed to:', contract.address);

    await new Promise(r => setTimeout(r, 30000));

    await hre.run('verify:verify', {
        address: contract.address,
        constructorArguments
    });
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
