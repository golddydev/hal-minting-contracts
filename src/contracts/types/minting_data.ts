import { MPTProof } from "./mpt.js";

interface MintingData {
  mpt_root_hash: string;
}

type Fulfilment = Array<[string, MPTProof]>;

export type { Fulfilment, MintingData };
