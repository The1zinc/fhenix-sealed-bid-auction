import hre from "hardhat";
import fs from "fs/promises";
import path from "path";

async function main() {
  const BlindAuction = await hre.ethers.getContractFactory("BlindAuction");
  const blindAuction = await BlindAuction.deploy();
  await blindAuction.waitForDeployment();

  const address = await blindAuction.getAddress();
  const artifact = await hre.artifacts.readArtifact("BlindAuction");
  const network = await hre.ethers.provider.getNetwork();

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    address,
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "../../frontend/lib/deployments.json");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(deployment, null, 2)}\n`, "utf8");

  console.log(`BlindAuction deployed to ${address}`);
  console.log(`Deployment metadata saved to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
