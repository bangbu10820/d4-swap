// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract LiquidityErc20 is ERC20 {
    uint256 private _currentSupply;
    uint8 private _decimals;

    Token bnb;
    Token usdt;

    uint private _k;
    uint bnbAmount;
    uint usdtAmount;

    bool init;

    address contractOwner;

    uint feePercentage;

    mapping(address account => uint256) private _lpHolders;

    constructor(
        string memory name,
        string memory symbol,
        uint8 decimal,
        Token _bnb,
        Token _usdt
    ) ERC20(name, symbol) {
        _decimals = decimal;
        feePercentage = 0;

        bnb = _bnb;
        usdt = _usdt;

        _k = 0;

        init = false;

        contractOwner = msg.sender;
    }

    function getBnbPrice() public view returns (uint) {
        return (_k / (bnbAmount - 10 ** bnb.decimals())) - usdtAmount;
    }

    function initFund(uint _bnbAmount, uint _usdtAmount) public {
        require(!init, "Can only init 1");
        init = true;

        bnb.transferFrom(msg.sender, address(this), _bnbAmount);
        usdt.transferFrom(msg.sender, address(this), _usdtAmount);
        bnbAmount = _bnbAmount;
        usdtAmount = _usdtAmount;
        _k = bnbAmount * usdtAmount;

        _currentSupply = ((_bnbAmount * (10 ** _decimals)) /
            (10 ** bnb.decimals()));
        _mint(msg.sender, _currentSupply);
    }

    function fund(uint _bnbAmount) public {
        uint newBnbAmount = bnbAmount + _bnbAmount;

        // This is the new usdt amount to maintain the price
        uint newUsdtAmount = (newBnbAmount * usdtAmount) / bnbAmount; // From Toandq's imagination

        // Take bnb and usdt from funder
        bnb.transferFrom(msg.sender, address(this), _bnbAmount);
        usdt.transferFrom(
            msg.sender,
            address(this),
            newUsdtAmount - usdtAmount
        );

        // Update bnb and usdt amount, and _k constant
        bnbAmount = newBnbAmount;
        usdtAmount = newUsdtAmount;
        _k = bnbAmount * usdtAmount;

        // Reward LP to funder
        uint rewardedLp = (_bnbAmount * _currentSupply) / bnbAmount;
        _mint(msg.sender, rewardedLp);
        _currentSupply += rewardedLp;
    }

    function withdraw(uint _lpAmount) public {
        require(balanceOf(msg.sender) > _lpAmount, "You dont have enough LP");

        // Calculate amount of withdraw bnb and new bnb amount
        uint withdrawBnbAmount = (_lpAmount * bnbAmount) / _currentSupply;
        uint newBnbAmount = bnbAmount - withdrawBnbAmount;

        // Calculate corresponding usdt amount need to fund and new usdt amount
        uint newUsdtAmount = (newBnbAmount * usdtAmount) / bnbAmount; // From Toandq's imagination
        uint withdrawUsdtAmount = usdtAmount - newUsdtAmount;

        // Burn LP
        _burn(msg.sender, _lpAmount);
        _currentSupply -= _lpAmount;

        // Update bnb and usdt amount and _k
        bnbAmount = newBnbAmount;
        usdtAmount = newUsdtAmount;
        _k = bnbAmount * usdtAmount;

        // Pay bnb and usdt
        bnb.transfer(msg.sender, withdrawBnbAmount);
        usdt.transfer(msg.sender, withdrawUsdtAmount);
    }

    function buy(uint _bnbAmount) public {
        require(_bnbAmount < bnbAmount, "Not enough BNB left");

        bnbAmount -= _bnbAmount;

        uint price = (_k / bnbAmount) - usdtAmount;

        uint fee = (_bnbAmount * feePercentage) / 100;

        usdt.transferFrom(msg.sender, address(this), price);

        usdtAmount += price;

        bnb.transfer(msg.sender, _bnbAmount - fee);
        bnb.transfer(contractOwner, fee);
        console.log(bnbAmount, usdtAmount);
    }

    function sell(uint _bnbAmount) public {
        bnbAmount += _bnbAmount;

        uint price = usdtAmount - (_k / bnbAmount);
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

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }
}
