import { MPTProof } from "./mpt.js";

interface MintingData {
  mpt_root_hash: string;
}

// asset hex name without asset name label
type Proof = [string, MPTProof];
type Proofs = Array<Proof>;

export type { MintingData, Proof, Proofs };
