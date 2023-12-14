import { ethers } from "hardhat";
import { EscrowErc20, Token, Swap } from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, parseEther } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { before, beforeEach } from "mocha";

describe("Swap contract", () => {
	let contract: Swap;
	let usdt: Token;
	let bnb: Token;

	let contractOwner: HardhatEthersSigner;
	let lender: HardhatEthersSigner;

	before(async () => {
		[contractOwner, lender] = await ethers.getSigners();

		const BNB = await ethers.getContractFactory("Token");
		bnb = await BNB.deploy("BNB", "BNB", 18);

		const USDT = await ethers.getContractFactory("Token");
		usdt = await USDT.deploy("USDT", "USDT", 18);

		const SWAP = await ethers.getContractFactory("Swap");
		contract = await SWAP.deploy(bnb, usdt);

		await usdt.transfer(contract, parseEther("100000"));
		await bnb.transfer(contract, parseEther("100000"));
	});

	it("should contract have correct addresses", async () => {
		expect(await contract.getBnbAddress()).to.eq(await bnb.getAddress());
		expect(await contract.getUsdtAddress()).to.eq(await usdt.getAddress());
	});

	it("should swap fail if dont have enought usdt", async () => {
		expect(contract.connect(lender).swapUsdtToBnb(parseEther("100"))).to
			.reverted;
	});

	describe("Swap", () => {
		let usdtBalance: bigint;
		let bnbBalance: bigint;

		beforeEach(async () => {
			await usdt.transfer(lender, parseEther("200"));

			usdtBalance = await usdt.balanceOf(lender);
			bnbBalance = await bnb.balanceOf(lender);
		});

		it("should swap success 200 usdt -> 1 bnb", async () => {
			const usdtSwapAmount = "200";
			const bnbSwapAmount = "1";

			await usdt
				.connect(lender)
				.approve(await contract.getAddress(), parseEther(usdtSwapAmount));

			const tx = await contract
				.connect(lender)
				.swapUsdtToBnb(parseEther(bnbSwapAmount));

			await expect(tx).to.changeTokenBalance(
				bnb,
				lender,
				parseEther(bnbSwapAmount)
			);
			// const receipt = await tx.wait();
			// console.log(receipt?.cumulativeGasUsed);
			// console.log(receipt?.gasPrice);
			// console.log(
			// 	(receipt?.cumulativeGasUsed || 0n) * (receipt?.gasPrice || 0n)
			// );

			const balanceAfter = await usdt.balanceOf(lender);

			expect(balanceAfter).to.eq(usdtBalance - parseEther(usdtSwapAmount));

			expect(await bnb.balanceOf(lender)).to.eq(
				bnbBalance + parseEther(bnbSwapAmount)
			);
		});

		it("should swap success 200/3", async () => {
			const usdtSwapAmount = (200 / 3).toString();
			const bnbSwapAmount = (1 / 3).toString();

			await usdt
				.connect(lender)
				.approve(await contract.getAddress(), parseEther(usdtSwapAmount));

			const tx = await contract
				.connect(lender)
				.swapUsdtToBnb(parseEther(bnbSwapAmount));

			await expect(tx).to.changeTokenBalance(
				usdt,
				lender,
				-parseEther((Number(bnbSwapAmount) * 200).toString())
			);
			expect(await bnb.balanceOf(lender)).to.greaterThan(bnbBalance);
			expect(await usdt.balanceOf(lender)).to.lessThan(usdtBalance);
		});
	});
});
