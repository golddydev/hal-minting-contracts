use aiken/merkle_patricia_forestry as mpt
use aiken/transaction/value.{AssetName}

// hex format without asset name label
pub type Proof =
  (AssetName, mpt.Proof)

pub type Proofs =
  List<Proof>
