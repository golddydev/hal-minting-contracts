import {
  InlineTxOutputDatum,
  ShelleyAddress,
  TxInput,
  TxOutput,
} from "@helios-lang/ledger";

// Order from user's perspective
type Order = {
  destinationAddress: ShelleyAddress;
  amount: number;
  // users can pass cost to process this order
  // sum of normal price or whitelisted price
  cost: bigint;
};

// Aggregated Order by destination address
type AggregatedOrder = {
  destinationAddress: ShelleyAddress;
  amount: number;
  // order UTxOs which are aggregated
  orderTxInputs: TxInput[];
  // need whitelist proof or not
  needWhitelistProof: boolean;
};

// H.A.L. Asset's Info
type HalAssetInfo = {
  assetUtf8Name: string;
  assetDatum: InlineTxOutputDatum;
};

// H.A.L. User's Output Data
// one user output has many H.A.L. User Assets
interface HalUserOutputData {
  assetUtf8Names: string[];
  destinationAddress: ShelleyAddress;
  userOutput: TxOutput;
}

export type { AggregatedOrder, HalAssetInfo, HalUserOutputData, Order };
