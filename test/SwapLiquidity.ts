import { ethers } from "hardhat";
import { EscrowErc20, Token, Swap, SwapLiquidity } from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, formatUnits, parseEther, parseUnits } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { before, beforeEach } from "mocha";

const parseEtherWithDecimal = (amount: number | string, decimals: bigint) =>
	parseUnits(amount.toString().substring(0, Number(decimals) + 1), decimals);
// BigInt(amount.toString()) * BigInt(10) ** decimals;

describe("Swap contract", () => {
	let contract: SwapLiquidity;
	let usdt: Token;
	let bnb: Token;

	let contractOwner: HardhatEthersSigner;
	let buyer: HardhatEthersSigner;

	let usdtDecimals: bigint = BigInt(6);
	let bnbDecimals: bigint = BigInt(18);

	before(async () => {
		[contractOwner, buyer] = await ethers.getSigners();

		const BNB = await ethers.getContractFactory("Token");
		bnb = await BNB.deploy("BNB", "BNB", bnbDecimals);

		const USDT = await ethers.getContractFactory("Token");
		usdt = await USDT.deploy("USDT", "USDT", usdtDecimals);

		const LIQUIDITY = await ethers.getContractFactory("SwapLiquidity");
		contract = await LIQUIDITY.deploy(bnb, usdt);

		await usdt.transfer(
			contractOwner,
			parseEtherWithDecimal(20000, usdtDecimals)
		);

		await usdt
			.connect(contractOwner)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(20000, usdtDecimals)
			);

		await bnb.transfer(contractOwner, parseEtherWithDecimal(100, bnbDecimals));

		await bnb
			.connect(contractOwner)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(100, bnbDecimals)
			);

		await contract.fund(
			parseEtherWithDecimal(100, bnbDecimals),
			parseEtherWithDecimal(20000, usdtDecimals)
		);
	});

	it("should contract have balance", async () => {
		expect(await bnb.balanceOf(contract)).to.eq(
			parseEtherWithDecimal(100, bnbDecimals)
		);
		expect(await usdt.balanceOf(contract)).to.eq(
			parseEtherWithDecimal(20000, usdtDecimals)
		);
	});

	it("should buy 1 bnb with > 200 usdt", async () => {
		await usdt.transfer(buyer, parseEtherWithDecimal(40000, usdtDecimals));

		await usdt
			.connect(buyer)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(40000, usdtDecimals)
			);

		expect(await bnb.balanceOf(buyer)).to.eq(
			parseEtherWithDecimal(0, bnbDecimals)
		);

		// expect(await usdt.balanceOf(buyer)).to.eq(
		// 	parseEtherWithDecimal(200, usdtDecimals)
		// );

		await expect(
			contract.connect(buyer).buy(parseEtherWithDecimal(1, bnbDecimals))
		).to.changeTokenBalance(bnb, buyer, parseEtherWithDecimal(1, bnbDecimals));

		expect(await bnb.balanceOf(buyer)).to.eq(
			parseEtherWithDecimal(1, bnbDecimals)
		);

		// expect(await usdt.balanceOf(buyer)).to.eq(
		// 	parseEtherWithDecimal(0, usdtDecimals)
		// );
	});

	it("should sell 1 bnb with > 200 usdt", async () => {
		await bnb
			.connect(buyer)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(1, bnbDecimals)
			);

		expect(await bnb.balanceOf(buyer)).to.eq(
			parseEtherWithDecimal(1, bnbDecimals)
		);

		// expect(await usdt.balanceOf(buyer)).to.eq(
		// 	parseEtherWithDecimal(0, usdtDecimals)
		// );

		await expect(
			contract.connect(buyer).sell(parseEtherWithDecimal(1, bnbDecimals))
		).to.changeTokenBalance(bnb, buyer, -parseEtherWithDecimal(1, bnbDecimals));

		expect(await bnb.balanceOf(buyer)).to.eq(
			parseEtherWithDecimal(0, bnbDecimals)
		);

		// expect(await usdt.balanceOf(buyer)).to.eq(
		// 	parseEtherWithDecimal(200, usdtDecimals)
		// );
	});

	it("should fail if try to buy all bnb", async () => {
		await expect(
			contract.connect(buyer).buy(parseEtherWithDecimal(10000, bnbDecimals))
		).to.revertedWith("Not enough BNB left");
	});

	describe("fee 10%", () => {
		before(async () => {
			await contract.setFeePercentage(BigInt(10));
		});

		it("should only receive 0.9 bnb if buy 1", async () => {
			await usdt.transfer(buyer, parseEtherWithDecimal(10000, usdtDecimals));

			await usdt
				.connect(buyer)
				.approve(
					await contract.getAddress(),
					parseEtherWithDecimal(10000, usdtDecimals)
				);

			expect(await bnb.balanceOf(buyer)).to.eq(
				parseEtherWithDecimal(0, bnbDecimals)
			);

			await expect(
				contract.connect(buyer).buy(parseEtherWithDecimal(1, bnbDecimals))
			).to.changeTokenBalance(
				bnb,
				contractOwner,
				parseEtherWithDecimal(0.1, bnbDecimals)
			);

			expect(await bnb.balanceOf(buyer)).to.eq(
				parseEtherWithDecimal(0.9, bnbDecimals)
			);
		});

		it("contract owner should receive usdt if anyone sell bnb", async () => {
			const usdtB = await usdt.balanceOf(contractOwner);
			console.log(usdtB);
			await usdt.connect(contractOwner).transfer(buyer, usdtB);

			expect(await usdt.balanceOf(contractOwner)).to.eq(
				parseEtherWithDecimal(0, usdtDecimals)
			);

			await bnb
				.connect(buyer)
				.approve(
					await contract.getAddress(),
					parseEtherWithDecimal(0.9, bnbDecimals)
				);

			await expect(
				contract.connect(buyer).sell(parseEtherWithDecimal(0.9, bnbDecimals))
			).to.changeTokenBalance(
				bnb,
				buyer,
				-parseEtherWithDecimal(0.9, bnbDecimals)
			);

			expect(await usdt.balanceOf(contractOwner)).to.greaterThan(
				parseEtherWithDecimal(0, usdtDecimals)
			);
		});
	});
});
