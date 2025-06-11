import { TxOutputDatum } from "@helios-lang/ledger";
import {
  expectByteArrayData,
  expectConstrData,
  makeByteArrayData,
  makeConstrData,
  makeIntData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";

import { invariant } from "../../helpers/index.js";
import {
  AssetNameProof,
  MintingData,
  Proofs,
  WhitelistedItem,
  WhitelistProof,
} from "../types/index.js";
import { buildMPTProofData } from "./mpt.js";

const buildMintingData = (mintingData: MintingData): UplcData => {
  const { mpt_root_hash, whitelist_mpt_root_hash } = mintingData;

  return makeConstrData(0, [
    makeByteArrayData(mpt_root_hash),
    makeByteArrayData(whitelist_mpt_root_hash),
  ]);
};

const decodeMintingDataDatum = (
  datum: TxOutputDatum | undefined
): MintingData => {
  invariant(
    datum?.kind == "InlineTxOutputDatum",
    "Minting Data Datum must be inline datum"
  );
  const datumData = datum.data;
  const mintingDataConstrData = expectConstrData(datumData, 0, 2);

  const mpt_root_hash = expectByteArrayData(
    mintingDataConstrData.fields[0],
    "mpt_root_hash must be ByteArray"
  ).toHex();

  const whitelist_mpt_root_hash = expectByteArrayData(
    mintingDataConstrData.fields[1],
    "whitelist_mpt_root_hash must be ByteArray"
  ).toHex();

  return { mpt_root_hash, whitelist_mpt_root_hash };
};

const buildAssetNameProofData = (assetNameProof: AssetNameProof): UplcData => {
  const [asset_name, mpt_proof] = assetNameProof;
  return makeListData([
    makeByteArrayData(asset_name),
    buildMPTProofData(mpt_proof),
  ]);
};

const buildAssetNameProofsData = (
  assetNameProofs: AssetNameProof[]
): UplcData => {
  return makeListData(assetNameProofs.map(buildAssetNameProofData));
};

const buildWhitelistedItemData = (
  whitelistedItem: WhitelistedItem
): UplcData => {
  const [time, amount] = whitelistedItem;
  return makeListData([makeIntData(time), makeIntData(amount)]);
};

const buildWhitelistProofData = (
  whitelistProofOpt: WhitelistProof | undefined
): UplcData => {
  if (!whitelistProofOpt) {
    // whitelistProof is None
    return makeConstrData(1, []);
  }
  // whitelistProof is Some
  const [whitelist_item, mpt_proof] = whitelistProofOpt;
  return makeConstrData(0, [
    buildWhitelistedItemData(whitelist_item),
    buildMPTProofData(mpt_proof),
  ]);
};

const buildProofsData = (proofs: Proofs): UplcData => {
  const [assetNameProofs, whitelistProofOpt] = proofs;

  return makeListData([
    buildAssetNameProofsData(assetNameProofs),
    buildWhitelistProofData(whitelistProofOpt),
  ]);
};

const buildMintingDataMintRedeemer = (proofsList: Proofs[]): UplcData => {
  return makeConstrData(0, [makeListData(proofsList.map(buildProofsData))]);
};

const buildMintingDataUpdateMPTRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export {
  buildMintingData,
  buildMintingDataMintRedeemer,
  buildMintingDataUpdateMPTRedeemer,
  decodeMintingDataDatum,
};
