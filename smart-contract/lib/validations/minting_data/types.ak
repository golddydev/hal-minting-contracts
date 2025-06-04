use aiken/merkle_patricia_forestry as mpt
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{AssetName}

// hex format without asset name label
pub type Proof =
  (AssetName, mpt.Proof)

pub type Proofs =
  List<Proof>

// when there are more than 1 order which has same destination
// those will be aggregated
pub type AggregatedOrder =
  (Address, Int)
