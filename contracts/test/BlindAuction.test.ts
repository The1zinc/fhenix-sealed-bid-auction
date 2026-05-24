import { expect } from "chai";
import hre, { ethers, network } from "hardhat";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";
import { mock_expectPlaintext } from "cofhe-hardhat-plugin";

function bigintToAddress(value: bigint): string {
  return ethers.getAddress(`0x${value.toString(16).padStart(40, "0")}`);
}

const TASK_MANAGER_ADDRESS = "0xeA30c4B8b44078Bbf8a6ef5b9f1eC1626C7848D9";
const ZK_VERIFIER_ADDRESS = "0x0000000000000000000000000000000000000100";

const AuctionType = {
  SealedBid: 0,
  English: 1,
  Dutch: 2,
} as const;

const AuctionStatus = {
  Active: 0,
  Ended: 1,
  Finalized: 2,
} as const;

describe("BlindAuction", function () {
  async function deployFixture() {
    await installLatestCofheMock();

    const [seller, bidderOne, bidderTwo, finalizer] = await ethers.getSigners();
    const BlindAuction = await ethers.getContractFactory("BlindAuction");
    const blindAuction = await BlindAuction.deploy();
    await blindAuction.waitForDeployment();

    return { blindAuction, seller, bidderOne, bidderTwo, finalizer };
  }

  async function sealedAuctionFixture() {
    const fixture = await deployFixture();
    await fixture.blindAuction.createAuction(3600, AuctionType.SealedBid, 0, 0);
    return fixture;
  }

  it("Should deploy successfully", async function () {
    const { blindAuction } = await loadFixture(deployFixture);

    expect(await blindAuction.getAddress()).to.match(/^0x[a-fA-F0-9]{40}$/);
    expect(await blindAuction.auctionCount()).to.equal(0n);
  });

  it("Should create typed auctions", async function () {
    const { blindAuction, seller } = await loadFixture(deployFixture);

    expect(await blindAuction.createAuction.staticCall(3600, AuctionType.SealedBid, 25, 0)).to.equal(1n);

    const tx = await blindAuction.createAuction(3600, AuctionType.SealedBid, 25, 0);
    await expect(tx)
      .to.emit(blindAuction, "AuctionCreated")
      .withArgs(1n, seller.address, AuctionType.SealedBid, anyValue, anyValue, 25n, 0n);

    const info = await blindAuction.getAuctionInfo(1);
    expect(info.auctionType).to.equal(AuctionType.SealedBid);
    expect(info.status).to.equal(AuctionStatus.Active);
    expect(info.startPrice).to.equal(25n);
    expect(await blindAuction.auctionCount()).to.equal(1n);
  });

  it("Should reject invalid Dutch price config", async function () {
    const { blindAuction } = await loadFixture(deployFixture);

    await expect(blindAuction.createAuction(3600, AuctionType.Dutch, 100, 125)).to.be.revertedWithCustomError(
      blindAuction,
      "InvalidPriceConfig",
    );
  });

  it("Should accept sealed bids and keep the highest encrypted", async function () {
    const { blindAuction, bidderOne, bidderTwo } = await loadFixture(sealedAuctionFixture);

    await expect(blindAuction.connect(bidderOne).placeBid(1, 100))
      .to.emit(blindAuction, "BidPlaced")
      .withArgs(1n, bidderOne.address, AuctionType.SealedBid, 0n);

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

  it("Should let anyone end a sealed auction after time expires", async function () {
    const { blindAuction, bidderOne, finalizer } = await loadFixture(sealedAuctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    await time.increase(3601);

    await expect(blindAuction.connect(finalizer).finalizeAuction(1))
      .to.emit(blindAuction, "AuctionEnded")
      .withArgs(1n, AuctionType.SealedBid)
      .and.to.emit(blindAuction, "EncryptedResultReady");

    const info = await blindAuction.getAuctionInfo(1);
    expect(info.status).to.equal(AuctionStatus.Ended);
  });

  it("Should reveal a sealed winner after encrypted handles are public", async function () {
    const { blindAuction, bidderOne, bidderTwo, finalizer } = await loadFixture(sealedAuctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    await blindAuction.connect(bidderTwo).placeBid(1, 150);
    await time.increase(3601);
    await blindAuction.connect(finalizer).finalizeAuction(1);

    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    const highestBidderHandle = await blindAuction.getHighestBidderHandle(1);
    await mock_expectPlaintext(ethers.provider as any, BigInt(highestBidHandle), 150n);

    const bidderPlaintext = await hre.cofhe.mocks.getPlaintext(BigInt(highestBidderHandle));
    const winner = bigintToAddress(bidderPlaintext);

    await expect(
      blindAuction.revealWinner(1, highestBidHandle, 150, "0x", highestBidderHandle, winner, "0x"),
    )
      .to.emit(blindAuction, "WinnerRevealed")
      .withArgs(1n, bidderTwo.address, 150n)
      .and.to.emit(blindAuction, "AuctionFinalized")
      .withArgs(1n, bidderTwo.address, 150n, AuctionType.SealedBid);

    const info = await blindAuction.getAuctionInfo(1);
    expect(info.status).to.equal(AuctionStatus.Finalized);
    expect(info.winningBid).to.equal(150n);
    expect(info.winningBidder).to.equal(bidderTwo.address);
  });

  it("Should reject sealed reveal before finalization releases handles", async function () {
    const { blindAuction, bidderOne } = await loadFixture(sealedAuctionFixture);

    await blindAuction.connect(bidderOne).placeBid(1, 100);
    const highestBidHandle = await blindAuction.getHighestBidHandle(1);
    const highestBidderHandle = await blindAuction.getHighestBidderHandle(1);

    await expect(
      blindAuction.revealWinner(1, highestBidHandle, 100, "0x", highestBidderHandle, bidderOne.address, "0x"),
    ).to.be.revertedWithCustomError(blindAuction, "AuctionResultNotReady");
  });

  it("Should run English auctions with public ascending bids", async function () {
    const { blindAuction, bidderOne, bidderTwo, finalizer } = await loadFixture(deployFixture);

    await blindAuction.createAuction(3600, AuctionType.English, 50, 0);

    await expect(blindAuction.connect(bidderOne).placeBid(1, 49)).to.be.revertedWithCustomError(
      blindAuction,
      "BidTooLow",
    );

    await blindAuction.connect(bidderOne).placeBid(1, 50);
    await expect(blindAuction.connect(bidderTwo).placeBid(1, 50)).to.be.revertedWithCustomError(
      blindAuction,
      "BidTooLow",
    );

    await blindAuction.connect(bidderTwo).placeBid(1, 75);
    await time.increase(3601);

    await expect(blindAuction.connect(finalizer).finalizeAuction(1))
      .to.emit(blindAuction, "AuctionFinalized")
      .withArgs(1n, bidderTwo.address, 75n, AuctionType.English);

    const info = await blindAuction.getAuctionInfo(1);
    expect(info.status).to.equal(AuctionStatus.Finalized);
    expect(info.winningBidder).to.equal(bidderTwo.address);
    expect(info.winningBid).to.equal(75n);
  });

  it("Should run Dutch auctions at the current descending price", async function () {
    const { blindAuction, bidderOne } = await loadFixture(deployFixture);

    await blindAuction.createAuction(3600, AuctionType.Dutch, 1000, 200);

    const openingPrice = await blindAuction.currentDutchPrice(1);
    expect(openingPrice).to.equal(1000n);

    await time.increase(1800);
    const currentPrice = await blindAuction.currentDutchPrice(1);
    expect(currentPrice).to.be.lessThan(1000n);
    expect(currentPrice).to.be.greaterThan(200n);

    await expect(blindAuction.connect(bidderOne).placeBid(1, currentPrice - 1n)).to.be.revertedWithCustomError(
      blindAuction,
      "BidTooLow",
    );

    await expect(blindAuction.connect(bidderOne).placeBid(1, currentPrice))
      .to.emit(blindAuction, "AuctionFinalized")
      .withArgs(1n, bidderOne.address, currentPrice, AuctionType.Dutch);

    const info = await blindAuction.getAuctionInfo(1);
    expect(info.status).to.equal(AuctionStatus.Finalized);
    expect(info.winningBidder).to.equal(bidderOne.address);
    expect(info.winningBid).to.equal(currentPrice);
  });

  it("Should expose a placeholder for future ZK proof verification", async function () {
    const { blindAuction } = await loadFixture(deployFixture);

    expect(await blindAuction.verifyDecryptionProofPlaceholder(1, "0x1234")).to.equal(false);
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
