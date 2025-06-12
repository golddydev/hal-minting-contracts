import {
  InlineTxOutputDatum,
  ShelleyAddress,
  TxOutput,
} from "@helios-lang/ledger";

type HalAssetInfo = [string, InlineTxOutputDatum];

interface HalUserOutputData {
  assetUtf8Names: string[];
  destinationAddress: ShelleyAddress;
  userOutput: TxOutput;
}

export type { HalAssetInfo, HalUserOutputData };
