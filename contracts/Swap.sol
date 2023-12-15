// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract Swap {
    Token bnb;
    Token usdt;

    uint256 price; // 1 BNB = price USDT

    constructor(Token _bnb, Token _usdt, uint256 _price) {
        bnb = _bnb;
        usdt = _usdt;
        price = _price;
    }

    // 1 bnb = 200 usdt
    function swapUsdtToBnb(uint _bnbAmount) public {
        uint usdtAmount = (_bnbAmount * price) / (10 ** bnb.decimals());

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
