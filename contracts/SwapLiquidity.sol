// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract SwapLiquidity {
    Token bnb;
    Token usdt;

    // uint256 price; // 1 BNB = price USDT
    bool init;
    uint k;
    uint bnbAmount;
    uint usdtAmount;

    address contractOwner;
    uint feePercentage;

    constructor(Token _bnb, Token _usdt) {
        bnb = _bnb;
        usdt = _usdt;
        // price = _price;
        init = false;
        k = 0;
        bnbAmount = 0;
        usdtAmount = 0;
        contractOwner = msg.sender;
        feePercentage = 0;
    }

    function fund(uint _bnbAmount, uint _usdtAmount) public {
        require(!init, "Can only init 1");
        init = true;
        bnb.transferFrom(msg.sender, address(this), _bnbAmount);
        usdt.transferFrom(msg.sender, address(this), _usdtAmount);
        k = _bnbAmount * _usdtAmount;
        bnbAmount = _bnbAmount;
        usdtAmount = _usdtAmount;
    }

    // 10 * 2000
    function buy(uint _bnbAmount) public {
        require(_bnbAmount < bnbAmount, "Not enough BNB left");
        // uint price = (k / bnbAmount / bnbAmount) * _bnbAmount;
        console.log(bnbAmount, usdtAmount);
        bnbAmount -= _bnbAmount;

        uint price = (k / bnbAmount) - usdtAmount;
        console.log(price);
        
        uint fee = (_bnbAmount * feePercentage) / 100;

        usdt.transferFrom(msg.sender, address(this), price);

        usdtAmount += price;

        bnb.transfer(msg.sender, _bnbAmount - fee);
        bnb.transfer(contractOwner, fee);
        console.log(bnbAmount, usdtAmount);
    }

    function sell(uint _bnbAmount) public {
        console.log(bnbAmount, usdtAmount);
        bnbAmount += _bnbAmount;

        uint price = usdtAmount - (k / bnbAmount);
        console.log(price);
        require(price < usdtAmount, "No USDT left");

        uint fee = (price * feePercentage) / 100;

        usdtAmount -= price;
        bnb.transferFrom(msg.sender, address(this), _bnbAmount);
        usdt.transfer(msg.sender, price - fee);
        usdt.transfer(contractOwner, fee);
        console.log(bnbAmount, usdtAmount);
    }

    function setFeePercentage(uint _feePercentage) public {
        require(msg.sender == contractOwner, "Only owner can do this");
        feePercentage = _feePercentage;
    }

    function getBnbAddress() public view returns (address) {
        return address(bnb);
    }

    function getUsdtAddress() public view returns (address) {
        return address(usdt);
    }
}
