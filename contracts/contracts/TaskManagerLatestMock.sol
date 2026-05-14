// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {EncryptedInput, FunctionId, ITaskManager} from "@fhenixprotocol/cofhe-contracts/ICofhe.sol";

contract TaskManagerLatestMock is ITaskManager {
    mapping(uint256 => uint256) public mockStorage;
    mapping(uint256 => bool) public inMockStorage;
    mapping(uint256 => bool) public publicAllowed;

    uint256 private nonce;

    function createTask(
        uint8 returnType,
        FunctionId funcId,
        uint256[] memory encryptedInputs,
        uint256[] memory extraInputs
    ) external override returns (uint256) {
        uint256 plaintext;

        if (funcId == FunctionId.trivialEncrypt) {
            plaintext = extraInputs[0];
        } else if (funcId == FunctionId.gt) {
            plaintext = mockStorage[encryptedInputs[0]] > mockStorage[encryptedInputs[1]] ? 1 : 0;
        } else if (funcId == FunctionId.max) {
            uint256 lhs = mockStorage[encryptedInputs[0]];
            uint256 rhs = mockStorage[encryptedInputs[1]];
            plaintext = lhs > rhs ? lhs : rhs;
        } else if (funcId == FunctionId.select) {
            plaintext = mockStorage[encryptedInputs[0]] != 0
                ? mockStorage[encryptedInputs[1]]
                : mockStorage[encryptedInputs[2]];
        } else {
            plaintext = encryptedInputs.length > 0 ? mockStorage[encryptedInputs[0]] : 0;
        }

        uint256 handle = _newHandle(returnType, funcId, encryptedInputs, extraInputs);
        mockStorage[handle] = plaintext;
        inMockStorage[handle] = true;
        return handle;
    }

    function createRandomTask(
        uint8 returnType,
        uint256 seed,
        int32 securityZone
    ) external override returns (uint256) {
        uint256[] memory encryptedInputs = new uint256[](0);
        uint256[] memory extraInputs = new uint256[](2);
        extraInputs[0] = seed;
        extraInputs[1] = uint256(uint32(securityZone));

        uint256 handle = _newHandle(returnType, FunctionId.random, encryptedInputs, extraInputs);
        mockStorage[handle] = seed;
        inMockStorage[handle] = true;
        return handle;
    }

    function createDecryptTask(uint256, address) external override {}

    function verifyInput(EncryptedInput memory input, address) external override returns (uint256) {
        mockStorage[input.ctHash] = input.ctHash;
        inMockStorage[input.ctHash] = true;
        return input.ctHash;
    }

    function allow(uint256, address) external override {}

    function isAllowed(uint256, address) external pure override returns (bool) {
        return true;
    }

    function isPubliclyAllowed(uint256 ctHash) external view override returns (bool) {
        return publicAllowed[ctHash];
    }

    function allowGlobal(uint256 ctHash) external override {
        publicAllowed[ctHash] = true;
    }

    function allowTransient(uint256, address) external override {}

    function getDecryptResultSafe(uint256 ctHash) external view override returns (uint256, bool) {
        return (mockStorage[ctHash], inMockStorage[ctHash]);
    }

    function getDecryptResult(uint256 ctHash) external view override returns (uint256) {
        return mockStorage[ctHash];
    }

    function publishDecryptResult(uint256 ctHash, uint256 result, bytes calldata) external override {
        mockStorage[ctHash] = result;
        inMockStorage[ctHash] = true;
    }

    function publishDecryptResultBatch(
        uint256[] calldata ctHashes,
        uint256[] calldata results,
        bytes[] calldata
    ) external override {
        for (uint256 i = 0; i < ctHashes.length; i++) {
            mockStorage[ctHashes[i]] = results[i];
            inMockStorage[ctHashes[i]] = true;
        }
    }

    function verifyDecryptResult(uint256, uint256, bytes calldata) external pure override returns (bool) {
        return true;
    }

    function verifyDecryptResultSafe(uint256, uint256, bytes calldata) external pure override returns (bool) {
        return true;
    }

    function verifyDecryptResultBatch(
        uint256[] calldata ctHashes,
        uint256[] calldata,
        bytes[] calldata
    ) external pure override returns (bool) {
        return ctHashes.length >= 0;
    }

    function verifyDecryptResultBatchSafe(
        uint256[] calldata ctHashes,
        uint256[] calldata,
        bytes[] calldata
    ) external pure override returns (bool[] memory results) {
        results = new bool[](ctHashes.length);
        for (uint256 i = 0; i < ctHashes.length; i++) {
            results[i] = true;
        }
    }

    function _newHandle(
        uint8 returnType,
        FunctionId funcId,
        uint256[] memory encryptedInputs,
        uint256[] memory extraInputs
    ) private returns (uint256) {
        nonce++;
        uint256 handle = uint256(keccak256(abi.encode(block.chainid, address(this), nonce, returnType, funcId, encryptedInputs, extraInputs)));
        return handle == 0 ? 1 : handle;
    }
}
