use aiken/transaction/credential.{Address}
use aiken/transaction/value.{AssetName}

// Royalty asset name
// "Royalty" with 500  asset name label
pub const royalty_asset_full_name: AssetName = #"001f4d70526f79616c7479"

pub type RoyaltyDatum {
  recipients: List<RoyaltyRecipient>,
  version: Int,
  extra: Data,
}

pub type RoyaltyRecipient {
  address: Address,
  // percentage (fraction)
  fee: Int,
  // fixed (absolute)
  min_fee: Option<Int>,
  // fixed (absolute)
  max_fee: Option<Int>,
}
