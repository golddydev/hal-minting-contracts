import { InlineTxOutputDatum, TxOutput } from "@helios-lang/ledger";

type HalAssetInfo = [string, InlineTxOutputDatum];

interface HalOutputsData {
  refOutputs: TxOutput[];
  userOutput: TxOutput;
  assetUtf8Names: string[];
}

export type { HalAssetInfo, HalOutputsData };
