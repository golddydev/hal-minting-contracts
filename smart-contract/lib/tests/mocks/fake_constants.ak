use aiken/transaction/credential.{Address}
use aiken/transaction/value.{AssetName, PolicyId}
use common/hashes.{ScriptHash, VerificationKeyHash}

// settings & minting_data asset
pub const settings_asset_policy_id: PolicyId =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

pub const settings_asset_name: AssetName =
  #"000de14064656d694068616e646c655f73657474696e6773"

pub const minting_data_asset_policy_id: PolicyId =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

pub const minting_data_asset_name: AssetName =
  #"000de14068616e646c655f726f6f744068616e646c655f73657474696e6773"

// settings

pub const mint_governor: ScriptHash = #"0000"

pub const mint_version: Int = 0

// settings v1

pub const hal_nft_policy_id: PolicyId =
  #"12345678123456781234567812345678123456781234567812345678"

pub const allowed_minter: VerificationKeyHash = #"11112222"

pub const hal_nft_price: Int = 180_000_000

pub const minting_data_script_hash: ScriptHash = #"1111"

pub const orders_spend_script_hash: ScriptHash = #"2222"

pub const ref_spend_proxy_script_hash: ScriptHash = #"3333"

pub const ref_spend_governor: ScriptHash = #"4444"

pub const ref_spend_admin: VerificationKeyHash = #"5555"

pub const royalty_spend_script_hash: ScriptHash = #"6666"

pub const max_order_amount: Int = 5

pub const minting_start_time: Int = 1718102400

pub fn payment_address() -> Address {
  credential.from_verification_key(#"7777")
    |> credential.with_delegation_key(#"8888")
}

// other constants
pub const min_order_lovelace = 3_000_000
