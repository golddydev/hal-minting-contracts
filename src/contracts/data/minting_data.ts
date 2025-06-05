import { TxOutputDatum } from "@helios-lang/ledger";
import {
  expectByteArrayData,
  expectConstrData,
  makeByteArrayData,
  makeConstrData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";

import { invariant } from "../../helpers/index.js";
import { MintingData, Proof, Proofs } from "../types/index.js";
import { buildMPTProofData } from "./mpt.js";

const buildMintingData = (mintingData: MintingData): UplcData => {
  return makeConstrData(0, [makeByteArrayData(mintingData.mpt_root_hash)]);
};

const decodeMintingDataDatum = (
  datum: TxOutputDatum | undefined
): MintingData => {
  invariant(
    datum?.kind == "InlineTxOutputDatum",
    "Minting Data Datum must be inline datum"
  );
  const datumData = datum.data;
  const mintingDataConstrData = expectConstrData(datumData, 0, 1);

  const mpt_root_hash = expectByteArrayData(
    mintingDataConstrData.fields[0],
    "mpt_root_hash must be ByteArray"
  ).toHex();

  return { mpt_root_hash };
};

const buildProofData = (proof: Proof): UplcData => {
  const [asset_name, mpt_proof] = proof;
  return makeListData([
    makeByteArrayData(asset_name),
    buildMPTProofData(mpt_proof),
  ]);
};

const buildProofsData = (proofs: Proofs): UplcData => {
  return makeListData(proofs.map(buildProofData));
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
