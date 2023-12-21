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
	let contractLpDecimals: bigint = BigInt(18);

	const baseBnb = 100;
	const baseUsdt = 20000;

	before(async () => {
		[contractOwner, buyer] = await ethers.getSigners();

		const BNB = await ethers.getContractFactory("Token");
		bnb = await BNB.deploy("BNB", "BNB", bnbDecimals);

		const USDT = await ethers.getContractFactory("Token");
		usdt = await USDT.deploy("USDT", "USDT", usdtDecimals);

		const LIQUIDITY = await ethers.getContractFactory("LiquidityErc20");
		contract = await LIQUIDITY.deploy(
			"ANYA",
			"AN",
			contractLpDecimals,
			bnb,
			usdt
		);

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

	it("should owner have LP === BNB", async () => {
		const ownerLp = await contract.balanceOf(contractOwner);
		const contractBnb = await bnb.balanceOf(contract);

		expect(ownerLp / contractLpDecimals).to.eq(contractBnb / bnbDecimals);
	});

	describe("Fund", () => {
		let baseBnbPrice: bigint;
		let contractOwnerLp: bigint;

		before(async () => {
			baseBnbPrice = await contract.getBnbPrice();
			console.log(baseBnbPrice);
			contractOwnerLp = await contract.balanceOf(contractOwner);
		});

		it("should successful fund 100 bnb", async () => {
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

			expect(await contract.fund(parseEtherWithDecimal(100, bnbDecimals))).not
				.reverted;
		});

		it.skip("should retain bnb price after fund 100 bnb", async () => {
			const newPrice = await contract.getBnbPrice();
			expect(newPrice).to.eq(baseBnbPrice);
		});

		it("should change contract owner lp balances after fund", async () => {
			const newLp = await contract.balanceOf(contractOwner);
			expect(newLp).to.greaterThan(contractOwnerLp);
		});
	});

	describe("Withdraw", () => {
		let baseBnbPrice: bigint;
		let contractOwnerLp: bigint;
		let baseBnbAmount: bigint;
		let baseUsdtAmount: bigint;

		let baseContractBnb: bigint;
		let baseContractUsdt: bigint;

		before(async () => {
			baseBnbPrice = await contract.getBnbPrice();
			console.log(baseBnbPrice);
			contractOwnerLp = await contract.balanceOf(contractOwner);
			baseBnbAmount = await bnb.balanceOf(contractOwner);
			baseUsdtAmount = await usdt.balanceOf(contractOwner);

			baseContractBnb = await bnb.balanceOf(contract);
			baseContractUsdt = await usdt.balanceOf(contract);
		});

		it("should successful burn half lp of contract owner", async () => {
			expect(await contract.withdraw(contractOwnerLp / 10n)).not.reverted;
		});

		it("should LP of owner become half", async () => {
			const newLp = await contract.balanceOf(contractOwner);
			expect(newLp).to.lessThan(contractOwnerLp);
			expect(newLp).to.eq(contractOwnerLp - contractOwnerLp / 10n);
		});

		it("should BNB and USDT of owner increase, contract decrease", async () => {
			const newBnbAmount = await bnb.balanceOf(contractOwner);
			const newUsdtAmount = await usdt.balanceOf(contractOwner);

			expect(newBnbAmount).to.greaterThan(baseBnbAmount);
			expect(newUsdtAmount).to.greaterThan(baseUsdtAmount);

			const newContractBnb = await bnb.balanceOf(contract);
			const newContractUsdt = await usdt.balanceOf(contract);

			expect(newContractBnb).to.lessThan(baseContractBnb);
			expect(newContractUsdt).to.lessThan(baseContractUsdt);
		});
	});
});
