import { MPTProof } from "./mpt.js";
import { WhitelistedValue } from "./whitelist.js";

interface MintingData {
  mpt_root_hash: string;
  whitelist_mpt_root_hash: string;
}

// asset hex name without asset name label
type AssetNameProof = [string, MPTProof];

type WhitelistProof = [WhitelistedValue, MPTProof];

type Proofs = [Array<AssetNameProof>, WhitelistProof | undefined];

export type { AssetNameProof, MintingData, Proofs, WhitelistProof };
