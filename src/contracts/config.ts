import {
  makeAddress,
  makeMintingPolicyHash,
  makeRegistrationDCert,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeValidatorHash,
} from "@helios-lang/ledger";
import { NetworkName } from "@helios-lang/tx-utils";

import {
  getCip68UplcProgram,
  getMintingDataSpendUplcProgram,
  getMintProxyMintUplcProgram,
  getMintV1WithdrawUplcProgram,
  getOrdersMintUplcProgram,
  getOrdersSpendUplcProgram,
} from "./validators.js";

/**
 * @interface
 * @typedef {object} BuildContractsParams
 * @property {NetworkName} network Cardano Network
 * @property {bigint} mint_version HAL NFT version
 * @property {string} admin_verification_key_hash Admin Verification Key Hash
 */
interface BuildContractsParams {
  network: NetworkName;
  mint_version: bigint;
  admin_verification_key_hash: string;
}

/**
 * @description Build Contracts for De-Mi from config
 * @param {BuildContractsParams} params
 * @returns All Contracts
 */
const buildContracts = (params: BuildContractsParams) => {
  const { network, mint_version, admin_verification_key_hash } = params;
  const isMainnet = network == "mainnet";

  // "mint_proxy.mint"
  const mintProxyMintUplcProgram = getMintProxyMintUplcProgram(mint_version);
  const mintProxyPolicyHash = makeMintingPolicyHash(
    mintProxyMintUplcProgram.hash()
  );
  const halPolicyHash = mintProxyPolicyHash;

  // "minting_data.spend"
  const mintingDataSpendUplcProgram = getMintingDataSpendUplcProgram(
    admin_verification_key_hash
  );
  const mintingDataValidatorHash = makeValidatorHash(
    mintingDataSpendUplcProgram.hash()
  );
  const mintingDataValidatorAddress = makeAddress(
    isMainnet,
    mintingDataValidatorHash
  );

  // "mint_v1.withdraw"
  const mintV1WithdrawUplcProgram = getMintV1WithdrawUplcProgram(
    mintingDataValidatorHash.toHex()
  );
  const mintV1ValidatorHash = makeValidatorHash(
    mintV1WithdrawUplcProgram.hash()
  );
  const mintV1StakingAddress = makeStakingAddress(
    isMainnet,
    makeStakingValidatorHash(mintV1WithdrawUplcProgram.hash())
  );
  const mintV1RegistrationDCert = makeRegistrationDCert(
    mintV1StakingAddress.stakingCredential
  );

  // "orders_mint.mint"
  const ordersMintUplcProgram = getOrdersMintUplcProgram(halPolicyHash.toHex());
  const ordersMintValidatorHash = makeValidatorHash(
    ordersMintUplcProgram.hash()
  );
  const ordersMintPolicyHash = makeMintingPolicyHash(ordersMintValidatorHash);

  // "orders.spend"
  const ordersSpendUplcProgram = getOrdersSpendUplcProgram(
    halPolicyHash.toHex(),
    ordersMintPolicyHash.toHex()
  );
  const ordersValidatorHash = makeValidatorHash(ordersSpendUplcProgram.hash());
  const ordersSpendValidatorAddress = makeAddress(
    isMainnet,
    ordersValidatorHash
  );

  // "cip68.spend"
  const cip68UplcProgram = getCip68UplcProgram();
  const cip68ValidatorHash = makeValidatorHash(cip68UplcProgram.hash());
  const cip68ValidatorAddress = makeAddress(isMainnet, cip68ValidatorHash);

  return {
    halPolicyHash,
    mintProxy: {
      mintProxyMintUplcProgram,
      mintProxyPolicyHash,
    },
    mintingData: {
      mintingDataSpendUplcProgram,
      mintingDataValidatorHash,
      mintingDataValidatorAddress,
    },
    mintV1: {
      mintV1WithdrawUplcProgram,
      mintV1ValidatorHash,
      mintV1StakingAddress,
      mintV1RegistrationDCert,
    },
    ordersMint: {
      ordersMintUplcProgram,
      ordersMintValidatorHash,
      ordersMintPolicyHash,
    },
    ordersSpend: {
      ordersSpendUplcProgram,
      ordersValidatorHash,
      ordersSpendValidatorAddress,
    },
    cip68: {
      cip68UplcProgram,
      cip68ValidatorHash,
      cip68ValidatorAddress,
    },
  };
};

export type { BuildContractsParams };
export { buildContracts };
