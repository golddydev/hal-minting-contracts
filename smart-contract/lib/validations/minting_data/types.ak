use aiken/merkle_patricia_forestry as mpt
use aiken/transaction/value.{AssetName}

// hex format without asset name label
pub type Fulfilment =
  Pairs<AssetName, mpt.Proof>
