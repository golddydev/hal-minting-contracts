import { MPTProof } from "./mpt.js";

interface MintingData {
  mpt_root_hash: string;
}

interface Proof {
  mpt_proof: MPTProof;
  // hex format without asset name label
  asset_name: string;
}

export type { MintingData, Proof };
