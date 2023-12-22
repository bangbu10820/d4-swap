// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./Token.sol";
import "hardhat/console.sol";

contract LiquidityErc20 is ERC20 {
    mapping(address account => uint256) private _balances;
    uint256 private _totalSupply;

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

    uint currentBnbRewardPerLp;
    uint rewardDecimals;

    mapping(address => uint) claimedBnbReward;
    mapping(address => uint) ignoreBnbAmount;
    mapping(address => uint) pendingBnbAmount;

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

        currentBnbRewardPerLp = 0;
        rewardDecimals = 10 ** 24;

        _currentSupply = 0;
    }

    function updateCurrentBnbRewardPerLp(uint _bnbAmount) private {
        uint r = (_bnbAmount * rewardDecimals) / _currentSupply;
        currentBnbRewardPerLp += r;
    }

    function claimReward() public {
        uint reward = calculateClaimableReward(msg.sender);

        pendingBnbAmount[msg.sender] = 0;
        claimedBnbReward[msg.sender] += reward;

        bnb.transfer(msg.sender, reward / rewardDecimals);
    }

    function calculateClaimableReward(
        address account
    ) private view returns (uint) {
        return
            currentBnbRewardPerLp *
            balanceOf(account) -
            claimedBnbReward[account] -
            ignoreBnbAmount[account] +
            pendingBnbAmount[account];
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

        // Calculate reward
        updateCurrentBnbRewardPerLp(fee);
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

    /**
     * @dev Transfers a `value` amount of tokens from `from` to `to`, or alternatively mints (or burns) if `from`
     * (or `to`) is the zero address. All customizations to transfers, mints, and burns should be done by overriding
     * this function.
     *
     * Emits a {Transfer} event.
     */
    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override {
        bool isMint = from == address(0);
        bool isBurn = to == address(0);
        // Mint
        if (isMint) {
            // Overflow check required: The rest of the code assumes that totalSupply never overflows
            _totalSupply += value;
            ignoreBnbAmount[to] += currentBnbRewardPerLp * value;
        } else {
            uint256 fromBalance = _balances[from];
            if (fromBalance < value) {
                revert ERC20InsufficientBalance(from, fromBalance, value);
            }
            if (isBurn) {
                uint burnedReward = currentBnbRewardPerLp * value;

                pendingBnbAmount[from] += burnedReward;
            }
            unchecked {
                // Overflow not possible: value <= fromBalance <= totalSupply.
                _balances[from] = fromBalance - value;
            }
        }

        // burn
        if (isBurn) {
            unchecked {
                // Overflow not possible: value <= totalSupply or value <= fromBalance <= totalSupply.
                _totalSupply -= value;
            }
        } else {
            unchecked {
                // Overflow not possible: balance + value is at most totalSupply, which we know fits into a uint256.
                _balances[to] += value;
            }
        }

        emit Transfer(from, to, value);
    }
}
