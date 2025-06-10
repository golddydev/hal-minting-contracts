use aiken/merkle_patricia_forestry as mpt
use aiken/transaction/value.{AssetName}
use hal_nft_mint/whitelist.{WhitelistedItem}

// hex format without asset name label
pub type AssetNameProof =
  (AssetName, mpt.Proof)

// whitelist proof
pub type WhitelistProof =
  (WhitelistedItem, mpt.Proof)

// asset name proofs and whitelist proof (which is optional)
pub type Proofs =
  (List<AssetNameProof>, Option<WhitelistProof>)
