import { UplcData } from "@helios-lang/uplc";

interface Settings {
  // mint withdrawal validator hash
  // this is mint_proxy governor
  mint_governor: string;
  // H.A.L. NFT's version
  mint_version: bigint;
  // setting v1 data
  data: UplcData;
}

export type { Settings };
