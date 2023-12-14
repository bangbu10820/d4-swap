// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Swap {
    IERC20 bnb;
    IERC20 usdt;

    constructor(IERC20 _bnb, IERC20 _usdt) {
        bnb = _bnb;
        usdt = _usdt;
    }

    // 1 bnb = 200 usdt
    function swapUsdtToBnb(uint _amount) public {
        usdt.transferFrom(msg.sender, address(this), _amount);
        uint bnbAmount = _amount / 200;
        bnb.transfer(msg.sender, bnbAmount);
    }

    // function fund(
    //     IERC20 _token,
    //     address _borrower,
    //     uint _loan,
    //     uint _steps
    // ) external {
    //     require(lender == address(0), "You cant fund again");
    //     lender = msg.sender;
    //     borrower = _borrower;
    //     loan = _loan;
    //     token = _token;
    //     steps = _steps;
    //     claimedSteps = 0;
    //     lockedAt = block.timestamp;
    //     claimedAmount = 0;

    //     token.transferFrom(msg.sender, address(this), _loan);
    // }

    function getBnbAddress() public view returns (address) {
        return address(bnb);
    }

    function getUsdtAddress() public view returns (address) {
        return address(usdt);
    }
}
