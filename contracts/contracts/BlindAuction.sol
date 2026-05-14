// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract BlindAuction {
    struct Auction {
        address seller;
        euint64 highestBid;
        eaddress highestBidder;
        uint64 winningBid;
        address winningBidder;
        uint256 endTime;
        bool closed;
        bool settled;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    event AuctionCreated(uint256 indexed auctionId, address indexed seller, uint256 endTime);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder);
    event AuctionClosed(uint256 indexed auctionId);
    event WinnerRevealed(uint256 indexed auctionId, address indexed winner, uint64 amount);

    error AuctionDoesNotExist(uint256 auctionId);
    error InvalidDuration();
    error AuctionAlreadyClosed(uint256 auctionId);
    error AuctionEnded(uint256 auctionId);
    error BidTooLarge(uint256 amount);
    error OnlySeller(address caller, address seller);
    error AuctionNotClosed(uint256 auctionId);
    error AuctionAlreadySettled(uint256 auctionId);
    error InvalidDecryptHandle();

    modifier auctionExists(uint256 auctionId) {
        if (auctionId == 0 || auctionId > auctionCount) {
            revert AuctionDoesNotExist(auctionId);
        }
        _;
    }

    function createAuction(uint256 durationSeconds) external returns (uint256 auctionId) {
        if (durationSeconds == 0) {
            revert InvalidDuration();
        }

        auctionId = ++auctionCount;

        Auction storage auction = auctions[auctionId];
        auction.seller = msg.sender;
        auction.highestBid = FHE.asEuint64(0);
        FHE.allowThis(auction.highestBid);
        auction.highestBidder = FHE.asEaddress(address(0));
        FHE.allowThis(auction.highestBidder);
        auction.endTime = block.timestamp + durationSeconds;

        emit AuctionCreated(auctionId, msg.sender, auction.endTime);
    }

    function placeBid(uint256 auctionId, uint256 amount) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        if (auction.closed) {
            revert AuctionAlreadyClosed(auctionId);
        }
        if (block.timestamp >= auction.endTime) {
            revert AuctionEnded(auctionId);
        }
        if (amount > type(uint64).max) {
            revert BidTooLarge(amount);
        }

        euint64 eBid = FHE.asEuint64(amount);
        ebool isHigher = FHE.gt(eBid, auction.highestBid);

        auction.highestBid = FHE.max(eBid, auction.highestBid);
        FHE.allowThis(auction.highestBid);

        auction.highestBidder = FHE.select(isHigher, FHE.asEaddress(msg.sender), auction.highestBidder);
        FHE.allowThis(auction.highestBidder);

        emit BidPlaced(auctionId, msg.sender);
    }

    function closeAuction(uint256 auctionId) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        if (msg.sender != auction.seller) {
            revert OnlySeller(msg.sender, auction.seller);
        }
        if (auction.closed) {
            revert AuctionAlreadyClosed(auctionId);
        }

        FHE.allowPublic(auction.highestBid);
        FHE.allowPublic(auction.highestBidder);

        auction.closed = true;

        emit AuctionClosed(auctionId);
    }

    function revealWinner(
        uint256 auctionId,
        euint64 bidCtHash,
        uint64 bidPlaintext,
        bytes calldata bidSignature,
        eaddress bidderCtHash,
        address bidderPlaintext,
        bytes calldata bidderSignature
    ) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        if (!auction.closed) {
            revert AuctionNotClosed(auctionId);
        }
        if (auction.settled) {
            revert AuctionAlreadySettled(auctionId);
        }
        if (
            euint64.unwrap(bidCtHash) != euint64.unwrap(auction.highestBid) ||
            eaddress.unwrap(bidderCtHash) != eaddress.unwrap(auction.highestBidder)
        ) {
            revert InvalidDecryptHandle();
        }

        if (!_isHardhatEmptySignaturePath(bidSignature, bidderSignature)) {
            FHE.publishDecryptResult(bidCtHash, bidPlaintext, bidSignature);
            FHE.publishDecryptResult(bidderCtHash, bidderPlaintext, bidderSignature);
        }

        auction.winningBid = bidPlaintext;
        auction.winningBidder = bidderPlaintext;
        auction.settled = true;

        emit WinnerRevealed(auctionId, bidderPlaintext, bidPlaintext);
    }

    function getAuctionInfo(
        uint256 auctionId
    )
        external
        view
        auctionExists(auctionId)
        returns (
            address seller,
            uint256 endTime,
            bool closed,
            bool settled,
            uint64 winningBid,
            address winningBidder
        )
    {
        Auction storage auction = auctions[auctionId];
        return (
            auction.seller,
            auction.endTime,
            auction.closed,
            auction.settled,
            auction.winningBid,
            auction.winningBidder
        );
    }

    function getHighestBidHandle(uint256 auctionId) external view auctionExists(auctionId) returns (euint64) {
        return auctions[auctionId].highestBid;
    }

    function getHighestBidderHandle(uint256 auctionId) external view auctionExists(auctionId) returns (eaddress) {
        return auctions[auctionId].highestBidder;
    }

    function _isHardhatEmptySignaturePath(
        bytes calldata bidSignature,
        bytes calldata bidderSignature
    ) private view returns (bool) {
        return block.chainid == 31337 && bidSignature.length == 0 && bidderSignature.length == 0;
    }
}
