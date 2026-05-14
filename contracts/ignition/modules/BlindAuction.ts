import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const BlindAuctionModule = buildModule("BlindAuctionModule", (m) => {
  const blindAuction = m.contract("BlindAuction");

  return { blindAuction };
});

export default BlindAuctionModule;
