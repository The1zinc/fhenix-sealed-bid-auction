import { expect } from "chai";
import hre, { ethers, network } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mock_expectPlaintext } from "cofhe-hardhat-plugin";

function bigintToAddress(value: bigint): string {
  return ethers.getAddress(`0x${value.toString(16).padStart(40, "0")}`);
}

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const ZK_VERIFIER_ADDRESS = "0x0000000000000000000000000000000000000100";

describe("BlindAuction", function () {
  async function deployFixture() {
    await installLatestCofheMock();

    const [seller, bidderOne, bidderTwo] = await ethers.getSigners();
    const BlindAuction = await ethers.getContractFactory("BlindAuction");
    const blindAuction = await BlindAuction.deploy();
    await blindAuction.waitForDeployment();

    return { blindAuction, seller, bidderOne, bidderTwo };
  }

  async function auctionFixture() {
    const fixture = await deployFixture();
    await fixture.blindAuction.createAuction(3600);
    return fixture;
  }

  it("Should deploy successfully", async function () {
    const { blindAuction } = await loadFixture(deployFixture);

    expect(await blindAuction.getAddress()).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(await blindAuction.auctionCount()).to.equal(0n);
  });

  it("Should create an auction and return auctionId = 1", async function () {
    const { blindAuction, seller } = await loadFixture(deployFixture);

    expect(await blindAuction.createAuction.staticCall(3600)).to.equal(1n);

    const tx = await blindAuction.createAuction(3600);
    await expect(tx).to.emit(blindAuction, "AuctionCreated").withArgs(1n, seller.address, anyValue);
    expect(await blindAuction.auctionCount()).to.equal(1n);
  });

  it("Should accept a bid and update highestBid", async function () {
    const { blindAuction, bidderOne } = await loadFixture(auctionFixture);

    await expect(blindAuction.connect(bidderOne).placeBid(1, 100))
      .to.emit(blindAuction, "BidPlaced")
      .withArgs(1n, bidderOne.address);

    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    await mock_expectPlaintext(ethers.provider as any, BigInt(highestBidHandle), 100n);
  });

  it("Should keep the highest of two bids encrypted", async function () {
    const { blindAuction, bidderOne, bidderTwo } = await loadFixture(auctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    await blindAuction.connect(bidderTwo).placeBid(1, 75);

    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    await mock_expectPlaintext(ethers.provider as any, BigInt(highestBidHandle), 100n);

    await blindAuction.connect(bidderTwo).placeBid(1, 150);

    const updatedHighestBidHandle = await blindAuction.getHighestBidHandle(1);
    const updatedHighestBidderHandle = await blindAuction.getHighestBidderHandle(1);
    await mock_expectPlaintext(ethers.provider as any, BigInt(updatedHighestBidHandle), 150n);

    const bidderPlaintext = await hre.cofhe.mocks.getPlaintext(BigInt(updatedHighestBidderHandle));
    expect(bigintToAddress(bidderPlaintext)).to.equal(bidderTwo.address);
  });

  it("Should revert placeBid after closeAuction", async function () {
    const { blindAuction, bidderOne } = await loadFixture(auctionFixture);

    await blindAuction.closeAuction(1);

    await expect(blindAuction.connect(bidderOne).placeBid(1, 100)).to.be.revertedWithCustomError(
      blindAuction,
      "AuctionAlreadyClosed",
    );
  });

  it("Should close auction with onlyAuctioneer enforced", async function () {
    const { blindAuction, bidderOne } = await loadFixture(auctionFixture);

    await expect(blindAuction.connect(bidderOne).closeAuction(1)).to.be.revertedWithCustomError(
      blindAuction,
      "OnlySeller",
    );

    await expect(blindAuction.closeAuction(1)).to.emit(blindAuction, "AuctionClosed").withArgs(1n);

    const [, , closed] = await blindAuction.getAuctionInfo(1);
    expect(closed).to.equal(true);
  });

  it("Should revealWinner correctly after close", async function () {
    const { blindAuction, bidderOne, bidderTwo } = await loadFixture(auctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    await blindAuction.connect(bidderTwo).placeBid(1, 150);
    await blindAuction.closeAuction(1);

    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    const highestBidderHandle = await blindAuction.getHighestBidderHandle(1);
    await mock_expectPlaintext(ethers.provider as any, BigInt(highestBidHandle), 150n);

    const bidderPlaintext = await hre.cofhe.mocks.getPlaintext(BigInt(highestBidderHandle));
    const winner = bigintToAddress(bidderPlaintext);

    await expect(
      blindAuction.revealWinner(1, highestBidHandle, 150, "0x", highestBidderHandle, winner, "0x"),
    )
      .to.emit(blindAuction, "WinnerRevealed")
      .withArgs(1n, bidderTwo.address, 150n);

    const [, , , settled, winningBid, winningBidder] = await blindAuction.getAuctionInfo(1);
    expect(settled).to.equal(true);
    expect(winningBid).to.equal(150n);
    expect(winningBidder).to.equal(bidderTwo.address);
  });

  it("Should revert revealWinner if auction not closed", async function () {
    const { blindAuction, bidderOne } = await loadFixture(auctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    const highestBidderHandle = await blindAuction.getHighestBidderHandle(1);

    await expect(
      blindAuction.revealWinner(1, highestBidHandle, 100, "0x", highestBidderHandle, bidderOne.address, "0x"),
    ).to.be.revertedWithCustomError(blindAuction, "AuctionNotClosed");
  });
});

async function installLatestCofheMock() {
  const MockTaskManager = await ethers.getContractFactory("TaskManagerLatestMock");
  const mockTaskManager = await MockTaskManager.deploy();
  await mockTaskManager.waitForDeployment();

  const runtimeBytecode = await ethers.provider.getCode(await mockTaskManager.getAddress());
  await network.provider.send("hardhat_setCode", [TASK_MANAGER_ADDRESS, runtimeBytecode]);
  await network.provider.send("hardhat_setCode", [ZK_VERIFIER_ADDRESS, "0x00"]);
}
