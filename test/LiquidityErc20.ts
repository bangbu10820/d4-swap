import { ethers } from "hardhat";
import {
	EscrowErc20,
	Token,
	Swap,
	SwapLiquidity,
	LiquidityErc20,
} from "../typechain-types";
import { expect } from "chai";
import { ZeroAddress, formatUnits, parseEther, parseUnits } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { time } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { before, beforeEach } from "mocha";

const parseEtherWithDecimal = (amount: number | string, decimals: bigint) =>
	parseUnits(amount.toString().substring(0, Number(decimals) + 1), decimals);
// BigInt(amount.toString()) * BigInt(10) ** decimals;

describe("Swap contract", () => {
	let contract: LiquidityErc20;
	let usdt: Token;
	let bnb: Token;

	let contractOwner: HardhatEthersSigner;
	let buyer: HardhatEthersSigner;

	let usdtDecimals: bigint = BigInt(6);
	let bnbDecimals: bigint = BigInt(18);

	const baseBnb = 100;
	const baseUsdt = 200;

	before(async () => {
		[contractOwner, buyer] = await ethers.getSigners();

		const BNB = await ethers.getContractFactory("Token");
		bnb = await BNB.deploy("BNB", "BNB", bnbDecimals);

		const USDT = await ethers.getContractFactory("Token");
		usdt = await USDT.deploy("USDT", "USDT", usdtDecimals);

		const LIQUIDITY = await ethers.getContractFactory("LiquidityErc20");
		contract = await LIQUIDITY.deploy("ANYA", "AN", 18, bnb, usdt);

		await usdt.transfer(
			contractOwner,
			parseEtherWithDecimal(baseUsdt, usdtDecimals)
		);

		await usdt
			.connect(contractOwner)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(baseUsdt, usdtDecimals)
			);

		await bnb.transfer(
			contractOwner,
			parseEtherWithDecimal(baseBnb, bnbDecimals)
		);

		await bnb
			.connect(contractOwner)
			.approve(
				await contract.getAddress(),
				parseEtherWithDecimal(baseBnb, bnbDecimals)
			);

		await contract.initFund(
			parseEtherWithDecimal(baseBnb, bnbDecimals),
			parseEtherWithDecimal(baseUsdt, usdtDecimals)
		);
	});

	it("should contract have balance", async () => {
		expect(await bnb.balanceOf(contract)).to.eq(
			parseEtherWithDecimal(baseBnb, bnbDecimals)
		);
		expect(await usdt.balanceOf(contract)).to.eq(
			parseEtherWithDecimal(baseUsdt, usdtDecimals)
		);
	});

	describe("Fund", () => {
		let baseBnbPrice: bigint;

		before(async () => {
			baseBnbPrice = await contract.getBnbPrice();
			console.log(baseBnbPrice);
		});

		it("should retain bnb price after fund 100 bnb", async () => {
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

			await bnb.transfer(
				contractOwner,
				parseEtherWithDecimal(100, bnbDecimals)
			);

			await bnb
				.connect(contractOwner)
				.approve(
					await contract.getAddress(),
					parseEtherWithDecimal(100, bnbDecimals)
				);

			await contract.fund(parseEtherWithDecimal(100, bnbDecimals));

			const newPrice = await contract.getBnbPrice();
			expect(newPrice).to.eq(baseBnbPrice);
		});
	});
});
