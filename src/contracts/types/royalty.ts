import { ShelleyAddress } from "@helios-lang/ledger";
import { UplcData } from "@helios-lang/uplc";

interface RoyaltyDatum {
  recipients: Array<RoyaltyRecipient>;
  version: number;
  extra: UplcData;
}

interface RoyaltyRecipient {
  address: ShelleyAddress;
  // percentage (fraction)
  fee: bigint;
  // fixed (absolute)
  min_fee?: bigint | undefined;
  // fixed (absolute)
  max_fee?: bigint | undefined;
}

export type { RoyaltyDatum, RoyaltyRecipient };
