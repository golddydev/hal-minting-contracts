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
  getMintingDataSpendUplcProgram,
  getMintProxyMintUplcProgram,
  getMintWithdrawUplcProgram,
  getOrdersSpendUplcProgram,
  getRefSpendUplcProgram,
} from "./validators.js";

/**
 * @interface
 * @typedef {object} BuildContractsParams
 * @property {NetworkName} network Cardano Network
 * @property {bigint} mint_version HAL NFT version
 * @property {string} admin_verification_key_hash Admin Verification Key Hash
 * @property {string} orders_spend_randomizer Orders Spend Randomizer (hex string)
 */
interface BuildContractsParams {
  network: NetworkName;
  mint_version: bigint;
  admin_verification_key_hash: string;
  orders_spend_randomizer?: string | undefined;
}

/**
 * @description Build Contracts for De-Mi from config
 * @param {BuildContractsParams} params
 * @returns All Contracts
 */
const buildContracts = (params: BuildContractsParams) => {
  const {
    network,
    mint_version,
    admin_verification_key_hash,
    orders_spend_randomizer = "",
  } = params;
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

  // "mint.withdraw"
  const mintWithdrawUplcProgram = getMintWithdrawUplcProgram(
    mintingDataValidatorHash.toHex()
  );
  const mintValidatorHash = makeValidatorHash(mintWithdrawUplcProgram.hash());
  const mintStakingAddress = makeStakingAddress(
    isMainnet,
    makeStakingValidatorHash(mintWithdrawUplcProgram.hash())
  );
  const mintRegistrationDCert = makeRegistrationDCert(
    mintStakingAddress.stakingCredential
  );

  // "orders.spend"
  const ordersSpendUplcProgram = getOrdersSpendUplcProgram(
    halPolicyHash.toHex(),
    orders_spend_randomizer
  );
  const ordersValidatorHash = makeValidatorHash(ordersSpendUplcProgram.hash());
  const ordersSpendValidatorAddress = makeAddress(
    isMainnet,
    ordersValidatorHash
  );

  // "ref_spend.spend"
  const refSpendUplcProgram = getRefSpendUplcProgram();
  const refSpendValidatorHash = makeValidatorHash(refSpendUplcProgram.hash());
  const refSpendValidatorAddress = makeAddress(
    isMainnet,
    refSpendValidatorHash
  );

  // "royalty_spend.spend"
  const royaltySpendUplcProgram = getRefSpendUplcProgram();
  const royaltySpendValidatorHash = makeValidatorHash(
    royaltySpendUplcProgram.hash()
  );
  const royaltySpendValidatorAddress = makeAddress(
    isMainnet,
    royaltySpendValidatorHash
  );

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
    mint: {
      mintWithdrawUplcProgram,
      mintValidatorHash,
      mintStakingAddress,
      mintRegistrationDCert,
    },
    ordersSpend: {
      ordersSpendUplcProgram,
      ordersValidatorHash,
      ordersSpendValidatorAddress,
    },
    refSpend: {
      refSpendUplcProgram,
      refSpendValidatorHash,
      refSpendValidatorAddress,
    },
    royaltySpend: {
      royaltySpendUplcProgram,
      royaltySpendValidatorHash,
      royaltySpendValidatorAddress,
    },
  };
};

export type { BuildContractsParams };
export { buildContracts };
