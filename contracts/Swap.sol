// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract Swap {
    Token bnb;
    Token usdt;

    constructor(Token _bnb, Token _usdt) {
        bnb = _bnb;
        usdt = _usdt;
    }

    // 1 bnb = 200 usdt
    function swapUsdtToBnb(uint _bnbAmount) public {
        uint bnbDecimals = bnb.decimals();
        uint usdtDecimals = usdt.decimals();
        uint pow;
        uint usdtAmount;

        if (bnbDecimals > usdtDecimals) {
            pow = bnbDecimals - usdtDecimals;
            usdtAmount = (_bnbAmount / (10 ** pow)) * 200;
        } else {
            pow = usdtDecimals - bnbDecimals;
            usdtAmount = _bnbAmount * (10 ** pow) * 200;
        }

        console.log("--------");
        console.log(pow);
        console.log("--------");

        console.log(usdtAmount, "usdtAmount");

        usdt.transferFrom(msg.sender, address(this), usdtAmount);
        bnb.transfer(msg.sender, _bnbAmount);
    }

    function getBnbAddress() public view returns (address) {
        return address(bnb);
    }

    function getUsdtAddress() public view returns (address) {
        return address(usdt);
    }
}
