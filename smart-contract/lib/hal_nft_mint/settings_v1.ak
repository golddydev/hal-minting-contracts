use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId}
use common/hashes.{ScriptHash, VerificationKeyHash}

pub type SettingsV1 {
  policy_id: PolicyId,
  // who can mint HAL NFTs
  allowed_minter: VerificationKeyHash,
  // hal nft's price
  hal_nft_price: Int,
  // minting data script is used to check
  // all minting handles logic (for both new and legacy)
  // minting_data_asset is locked inside that script
  minting_data_script_hash: ScriptHash,
  // user makes an order (as UTxO) to this script
  orders_spend_script_hash: ScriptHash,
  // ref_spend_proxy Spending validator hash
  // ref asset is sent to this script
  ref_spend_proxy_script_hash: ScriptHash,
  // ref_spend withdrawal validator hash
  // this is ref_spend_proxy governor
  ref_spend_governor: ScriptHash,
  // ref_spend admin is used to authorize updating CIP68 Datum
  // this is referred to as `ref_spend_admin` in `ref_spend` withdrawal validator
  ref_spend_admin: VerificationKeyHash,
  // royalty spend script hash
  // Royalty NFT is sent to this script
  royalty_spend_script_hash: ScriptHash,
  // when the minting (for everyone) starts
  minting_start_time: Int,
  // address to collect HAL NFT's cost
  payment_address: Address,
}
