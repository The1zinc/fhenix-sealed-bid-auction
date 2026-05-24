// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@fhenixprotocol/cofhe-contracts/FHE.sol";

contract BlindAuction {
    enum AuctionType {
        SealedBid,
        English,
        Dutch
    }

    enum AuctionStatus {
        Active,
        Ended,
        Finalized
    }

    struct Auction {
        address seller;
        AuctionType auctionType;
        AuctionStatus status;
        euint64 highestBid;
        eaddress highestBidder;
        uint64 currentBid;
        address currentBidder;
        uint64 winningBid;
        address winningBidder;
        uint64 startPrice;
        uint64 reservePrice;
        uint256 startTime;
        uint256 endTime;
    }

    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        AuctionType indexed auctionType,
        uint256 startTime,
        uint256 endTime,
        uint64 startPrice,
        uint64 reservePrice
    );
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, AuctionType indexed auctionType, uint64 publicAmount);
    event AuctionEnded(uint256 indexed auctionId, AuctionType indexed auctionType);
    event EncryptedResultReady(uint256 indexed auctionId, bytes32 bidHandle, bytes32 bidderHandle);
    event WinnerRevealed(uint256 indexed auctionId, address indexed winner, uint64 amount);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, uint64 amount, AuctionType indexed auctionType);

    error AuctionDoesNotExist(uint256 auctionId);
    error InvalidDuration();
    error InvalidPriceConfig();
    error AuctionNotActive(uint256 auctionId);
    error AuctionEndedAlready(uint256 auctionId);
    error AuctionNotEnded(uint256 auctionId);
    error AuctionAlreadyFinalized(uint256 auctionId);
    error AuctionResultNotReady(uint256 auctionId);
    error AuctionHasEnded(uint256 auctionId);
    error BidTooLarge(uint256 amount);
    error BidTooLow(uint256 submitted, uint256 required);
    error RevealOnlySealedBid(uint256 auctionId);
    error InvalidDecryptHandle();

    modifier auctionExists(uint256 auctionId) {
        if (auctionId == 0 || auctionId > auctionCount) {
            revert AuctionDoesNotExist(auctionId);
        }
        _;
    }

    function createAuction(
        uint256 durationSeconds,
        AuctionType auctionType,
        uint64 startPrice,
        uint64 reservePrice
    ) external returns (uint256 auctionId) {
        if (durationSeconds == 0) {
            revert InvalidDuration();
        }
        if (auctionType == AuctionType.Dutch && (startPrice == 0 || reservePrice > startPrice)) {
            revert InvalidPriceConfig();
        }

        auctionId = ++auctionCount;

        Auction storage auction = auctions[auctionId];
        auction.seller = msg.sender;
        auction.auctionType = auctionType;
        auction.status = AuctionStatus.Active;
        auction.highestBid = FHE.asEuint64(0);
        FHE.allowThis(auction.highestBid);
        auction.highestBidder = FHE.asEaddress(address(0));
        FHE.allowThis(auction.highestBidder);
        auction.startPrice = startPrice;
        auction.reservePrice = reservePrice;
        auction.startTime = block.timestamp;
        auction.endTime = block.timestamp + durationSeconds;

        emit AuctionCreated(
            auctionId,
            msg.sender,
            auctionType,
            auction.startTime,
            auction.endTime,
            startPrice,
            reservePrice
        );
    }

    function placeBid(uint256 auctionId, uint256 amount) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        if (auction.status != AuctionStatus.Active) {
            revert AuctionNotActive(auctionId);
        }
        if (block.timestamp >= auction.endTime) {
            revert AuctionHasEnded(auctionId);
        }
        if (amount > type(uint64).max) {
            revert BidTooLarge(amount);
        }

        uint64 bidAmount = uint64(amount);

        if (auction.auctionType == AuctionType.SealedBid) {
            _placeSealedBid(auctionId, auction, bidAmount);
        } else if (auction.auctionType == AuctionType.English) {
            _placeEnglishBid(auctionId, auction, bidAmount);
        } else {
            _placeDutchBid(auctionId, auction, bidAmount);
        }
    }

    function finalizeAuction(uint256 auctionId) external auctionExists(auctionId) {
        Auction storage auction = auctions[auctionId];

        if (auction.status == AuctionStatus.Finalized) {
            revert AuctionAlreadyFinalized(auctionId);
        }
        if (block.timestamp < auction.endTime) {
            revert AuctionNotEnded(auctionId);
        }

        if (auction.auctionType == AuctionType.SealedBid) {
            if (auction.status == AuctionStatus.Ended) {
                revert AuctionEndedAlready(auctionId);
            }

            FHE.allowPublic(auction.highestBid);
            FHE.allowPublic(auction.highestBidder);

            auction.status = AuctionStatus.Ended;

            emit AuctionEnded(auctionId, auction.auctionType);
            emit EncryptedResultReady(
                auctionId,
                euint64.unwrap(auction.highestBid),
                eaddress.unwrap(auction.highestBidder)
            );
            return;
        }

        auction.winningBid = auction.currentBid;
        auction.winningBidder = auction.currentBidder;
        auction.status = AuctionStatus.Finalized;

        emit AuctionEnded(auctionId, auction.auctionType);
        emit AuctionFinalized(auctionId, auction.winningBidder, auction.winningBid, auction.auctionType);
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

        if (auction.auctionType != AuctionType.SealedBid) {
            revert RevealOnlySealedBid(auctionId);
        }
        if (auction.status == AuctionStatus.Finalized) {
            revert AuctionAlreadyFinalized(auctionId);
        }
        if (auction.status != AuctionStatus.Ended) {
            revert AuctionResultNotReady(auctionId);
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
        auction.status = AuctionStatus.Finalized;

        emit WinnerRevealed(auctionId, bidderPlaintext, bidPlaintext);
        emit AuctionFinalized(auctionId, bidderPlaintext, bidPlaintext, auction.auctionType);
    }

    function getAuctionInfo(
        uint256 auctionId
    )
        external
        view
        auctionExists(auctionId)
        returns (
            address seller,
            AuctionType auctionType,
            AuctionStatus status,
            uint256 startTime,
            uint256 endTime,
            uint64 startPrice,
            uint64 reservePrice,
            uint64 currentBid,
            address currentBidder,
            uint64 winningBid,
            address winningBidder
        )
    {
        Auction storage auction = auctions[auctionId];
        return (
            auction.seller,
            auction.auctionType,
            _effectiveStatus(auction),
            auction.startTime,
            auction.endTime,
            auction.startPrice,
            auction.reservePrice,
            auction.currentBid,
            auction.currentBidder,
            auction.winningBid,
            auction.winningBidder
        );
    }

    function isEncryptedResultReady(uint256 auctionId) external view auctionExists(auctionId) returns (bool) {
        Auction storage auction = auctions[auctionId];
        return auction.auctionType == AuctionType.SealedBid && auction.status == AuctionStatus.Ended;
    }

    function currentDutchPrice(uint256 auctionId) public view auctionExists(auctionId) returns (uint64) {
        Auction storage auction = auctions[auctionId];
        if (auction.auctionType != AuctionType.Dutch) {
            return auction.currentBid;
        }
        if (block.timestamp >= auction.endTime) {
            return auction.reservePrice;
        }

        uint256 duration = auction.endTime - auction.startTime;
        uint256 elapsed = block.timestamp - auction.startTime;
        uint256 discount = (uint256(auction.startPrice - auction.reservePrice) * elapsed) / duration;
        return uint64(uint256(auction.startPrice) - discount);
    }

    function getHighestBidHandle(uint256 auctionId) external view auctionExists(auctionId) returns (euint64) {
        return auctions[auctionId].highestBid;
    }

    function getHighestBidderHandle(uint256 auctionId) external view auctionExists(auctionId) returns (eaddress) {
        return auctions[auctionId].highestBidder;
    }

    function verifyDecryptionProofPlaceholder(
        uint256 auctionId,
        bytes calldata proof
    ) external pure returns (bool verified) {
        auctionId;
        proof;
        // Placeholder for a future verifier contract that can validate a ZK proof
        // tying CoFHE decrypt outputs to the encrypted handles stored above.
        return false;
    }

    function _placeSealedBid(uint256 auctionId, Auction storage auction, uint64 amount) private {
        uint64 minimumBid = auction.startPrice == 0 ? 1 : auction.startPrice;
        if (amount < minimumBid) {
            revert BidTooLow(amount, minimumBid);
        }

        euint64 eBid = FHE.asEuint64(amount);
        ebool isHigher = FHE.gt(eBid, auction.highestBid);

        auction.highestBid = FHE.max(eBid, auction.highestBid);
        FHE.allowThis(auction.highestBid);

        auction.highestBidder = FHE.select(isHigher, FHE.asEaddress(msg.sender), auction.highestBidder);
        FHE.allowThis(auction.highestBidder);

        emit BidPlaced(auctionId, msg.sender, auction.auctionType, 0);
    }

    function _placeEnglishBid(uint256 auctionId, Auction storage auction, uint64 amount) private {
        uint64 minimumBid = auction.startPrice == 0 ? 1 : auction.startPrice;
        if (auction.currentBid == type(uint64).max) {
            revert BidTooLow(amount, type(uint64).max);
        }

        uint64 requiredBid = auction.currentBid >= minimumBid ? auction.currentBid + 1 : minimumBid;

        if (amount < requiredBid) {
            revert BidTooLow(amount, requiredBid);
        }

        auction.currentBid = amount;
        auction.currentBidder = msg.sender;

        emit BidPlaced(auctionId, msg.sender, auction.auctionType, amount);
    }

    function _placeDutchBid(uint256 auctionId, Auction storage auction, uint64 amount) private {
        uint64 askPrice = currentDutchPrice(auctionId);
        if (amount < askPrice) {
            revert BidTooLow(amount, askPrice);
        }

        auction.currentBid = askPrice;
        auction.currentBidder = msg.sender;
        auction.winningBid = askPrice;
        auction.winningBidder = msg.sender;
        auction.status = AuctionStatus.Finalized;

        emit BidPlaced(auctionId, msg.sender, auction.auctionType, askPrice);
        emit AuctionFinalized(auctionId, msg.sender, askPrice, auction.auctionType);
    }

    function _effectiveStatus(Auction storage auction) private view returns (AuctionStatus) {
        if (auction.status == AuctionStatus.Active && block.timestamp >= auction.endTime) {
            return AuctionStatus.Ended;
        }

        return auction.status;
    }

    function _isHardhatEmptySignaturePath(
        bytes calldata bidSignature,
        bytes calldata bidderSignature
    ) private view returns (bool) {
        return block.chainid == 31337 && bidSignature.length == 0 && bidderSignature.length == 0;
    }
}
