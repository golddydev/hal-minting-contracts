use aiken/merkle_patricia_forestry as mpt
use aiken/transaction/value.{AssetName}

pub type Proof {
  mpt_proof: mpt.Proof,
  // hex format without asset name label
  asset_name: AssetName,
}
