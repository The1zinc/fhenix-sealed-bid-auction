import { HardhatUserConfig } from "hardhat/config";
import { task } from "hardhat/config";
import {
  TASK_COMPILE,
  TASK_TEST,
  TASK_TEST_GET_TEST_FILES,
  TASK_TEST_RUN_MOCHA_TESTS,
  TASK_TEST_SETUP_TEST_ENVIRONMENT,
} from "hardhat/builtin-tasks/task-names";
import "@nomicfoundation/hardhat-toolbox";
import "cofhe-hardhat-plugin";
import * as dotenv from "dotenv";

import "./tasks/createAuction";
import "./tasks/placeBid";
import "./tasks/closeAuction";
import "./tasks/revealWinner";

dotenv.config();

task(TASK_TEST).setAction(async ({ testFiles, noCompile, parallel, bail, grep }, hre) => {
    if (!noCompile) {
      await hre.run(TASK_COMPILE, { quiet: true });
    }

    const files = await hre.run(TASK_TEST_GET_TEST_FILES, { testFiles });
    await hre.run(TASK_TEST_SETUP_TEST_ENVIRONMENT);
    const testFailures = await hre.run(TASK_TEST_RUN_MOCHA_TESTS, {
      testFiles: files,
      parallel,
      bail,
      grep,
    });

    process.exitCode = testFailures;
    return testFailures;
  });

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.19",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
      {
        version: "0.8.25",
        settings: { optimizer: { enabled: true, runs: 200 } },
      },
    ],
  },
  networks: {
    hardhat: {},
    arbSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC_URL || "https://sepolia-rollup.arbitrum.io/rpc",
      chainId: 421614,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  cofhe: {
    logMocks: false,
    gasWarning: false,
  },
};

export default config;
