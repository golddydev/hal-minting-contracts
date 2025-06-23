import { ShelleyAddress } from "@helios-lang/ledger";
import { UplcData } from "@helios-lang/uplc";

interface RoyaltyDatum {
  recipients: Array<RoyaltyRecipient>;
  version: number;
  extra: UplcData;
}

interface RoyaltyRecipient {
  address: ShelleyAddress;
  // percentage (0.1 - 100)
  fee: number;
  // fixed (absolute) fee
  min_fee?: bigint | undefined;
  // fixed (absolute) fee
  max_fee?: bigint | undefined;
}

export type { RoyaltyDatum, RoyaltyRecipient };
