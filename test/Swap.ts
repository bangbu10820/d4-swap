import { ethers } from "hardhat";
import { EscrowErc20, Token, Swap } from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, formatUnits, parseEther, parseUnits } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { before, beforeEach } from "mocha";

const parseEtherWithDecimal = (amount: number | string, decimals: bigint) =>
	parseUnits(amount.toString().substring(0, Number(decimals) + 1), decimals);
// BigInt(amount.toString()) * BigInt(10) ** decimals;

describe("Swap contract", () => {
	let contract: Swap;
	let usdt: Token;
	let bnb: Token;

	let contractOwner: HardhatEthersSigner;
	let lender: HardhatEthersSigner;

	let usdtDecimals: bigint = BigInt(6);
	let bnbDecimals: bigint = BigInt(18);

	before(async () => {
		[contractOwner, lender] = await ethers.getSigners();

		const BNB = await ethers.getContractFactory("Token");
		bnb = await BNB.deploy("BNB", "BNB", bnbDecimals);

		const USDT = await ethers.getContractFactory("Token");
		usdt = await USDT.deploy("USDT", "USDT", usdtDecimals);

		const SWAP = await ethers.getContractFactory("Swap");
		contract = await SWAP.deploy(bnb, usdt, parseUnits("200", usdtDecimals));

		await usdt.transfer(contract, parseEtherWithDecimal(100, usdtDecimals));
		await bnb.transfer(contract, parseEtherWithDecimal(10000, bnbDecimals));
	});

	it("should contract have correct addresses", async () => {
		expect(await contract.getBnbAddress()).to.eq(await bnb.getAddress());
		expect(await contract.getUsdtAddress()).to.eq(await usdt.getAddress());
	});

	it("should swap fail if dont have enought usdt", async () => {
		expect(
			contract
				.connect(lender)
				.swapUsdtToBnb(parseEtherWithDecimal(100, bnbDecimals))
		).to.reverted;
	});

	describe("Swap", () => {
		let usdtBalance: bigint;
		let bnbBalance: bigint;

		beforeEach(async () => {
			await usdt.transfer(lender, parseEtherWithDecimal(200, usdtDecimals));

			usdtBalance = await usdt.balanceOf(lender);
			bnbBalance = await bnb.balanceOf(lender);
		});

		it("should swap success 200 usdt -> 1 bnb", async () => {
			const usdtSwapAmount = "200";
			const bnbSwapAmount = "1";

			await usdt
				.connect(lender)
				.approve(
					await contract.getAddress(),
					parseEtherWithDecimal(usdtSwapAmount, usdtDecimals)
				);

			console.log(usdtBalance);

			const tx = await contract
				.connect(lender)
				.swapUsdtToBnb(parseEtherWithDecimal(bnbSwapAmount, bnbDecimals));

			await expect(tx).to.changeTokenBalance(
				bnb,
				lender,
				parseEtherWithDecimal(bnbSwapAmount, bnbDecimals)
			);
			// const receipt = await tx.wait();
			// console.log(receipt?.cumulativeGasUsed);
			// console.log(receipt?.gasPrice);
			// console.log(
			// 	(receipt?.cumulativeGasUsed || 0n) * (receipt?.gasPrice || 0n)
			// );

			const balanceAfter = await usdt.balanceOf(lender);

			expect(balanceAfter).to.eq(
				usdtBalance - parseEtherWithDecimal(usdtSwapAmount, usdtDecimals)
			);

			expect(await bnb.balanceOf(lender)).to.eq(
				bnbBalance + parseEtherWithDecimal(bnbSwapAmount, bnbDecimals)
			);
		});

		it("should swap success 200/3", async () => {
			const usdtSwapAmount = (200 / 3).toString();
			const bnbSwapAmount = (1 / 3).toString();
			await usdt
				.connect(lender)
				.approve(
					await contract.getAddress(),
					parseEtherWithDecimal("200".toString(), usdtDecimals)
				);

			const tx = await contract
				.connect(lender)
				.swapUsdtToBnb(parseEtherWithDecimal(bnbSwapAmount, bnbDecimals));

			await expect(tx).to.changeTokenBalance(
				bnb,
				lender,
				parseEtherWithDecimal(bnbSwapAmount, bnbDecimals)
			);
			expect(await bnb.balanceOf(lender)).to.greaterThan(bnbBalance);
			expect(await usdt.balanceOf(lender)).to.lessThan(usdtBalance);
		});
	});
});
