use aiken/transaction/credential.{Address}
use aiken/transaction/value.{AssetName, PolicyId}
use common/hashes.{ScriptHash, VerificationKeyHash}

// settings & minting_data asset
pub const settings_asset_policy_id: PolicyId =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

// hal@handle_settings
pub const settings_asset_name: AssetName =
  #"000de14068616c4068616e646c655f73657474696e6773"

pub const minting_data_asset_policy_id: PolicyId =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

// hal_pz@handle_settings

pub const ref_spend_settings_asset_policy_id: AssetName =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

pub const ref_spend_settings_asset_name: AssetName =
  #"000de14068616c5f707a4068616e646c655f73657474696e6773"

// hal_root@handle_settings
pub const minting_data_asset_name: AssetName =
  #"000de14068616c5f726f6f744068616e646c655f73657474696e6773"

// mint settings

pub const mint_governor: ScriptHash = #"0000"

pub const mint_version: Int = 0

pub const admin_verification_key_hash: VerificationKeyHash =
  #"1b3d235a54e52b00e9152df2481c5c569f03eb47977f13e2f6ea897e"

// mint settings v1

pub const hal_policy_id: PolicyId =
  #"c499deafed36ff9c272e2c335062df6e4bad2861d4c6c47fe682606d"

pub const allowed_minter: VerificationKeyHash =
  #"72ed9cc45ef8d8f3c7eed2a83345ed7e06ceff734a1087de01eaab17"

pub const hal_nft_price: Int = 180_000_000

pub const minting_data_script_hash: ScriptHash =
  #"45509021fa5925705c942ef75308d8b062838df7dab8a255907081c9"

pub const orders_spend_script_hash: ScriptHash =
  #"93782113eea6e12f418d2dfd672a2e8e5f73f88bf06013c7bb0515c6"

pub const ref_spend_proxy_script_hash: ScriptHash =
  #"1e843c41938b993a874c08ba9d2a122aa5b26da477c586ec8ab0f09a"

pub const royalty_spend_script_hash: ScriptHash =
  #"362755f51869d07968af9f0230f9a6f55edbf3b71931e8aeb2752f1c"

pub const minting_start_time: Int = 1751328000000

pub fn payment_address() -> Address {
  credential.from_verification_key(
    #"76ea19bca88325de5ccf00ad6b75380acd9faf8b0a4b236923a691cf",
  )
    |> credential.with_delegation_key(
        #"9c0f7872826c9e888fad5658571e3e78b2dbb77a8d24a4a39cc6a578",
      )
}

// ref spend settings

pub const ref_spend_governor: ScriptHash =
  #"cca2044fe962ae536e833f5b02896f33e621ebbe13ac220960e2cf8e"

// ref_spend settings v1

pub const ref_spend_admin: VerificationKeyHash =
  #"199e5911d352ef0a0d3582f09ce865924fcf7bd063a45d34414ac58b"

// User wallets
pub fn user_1_address() -> Address {
  credential.from_verification_key(
    #"2d8cd2fa0b6a46e037da14ca71b85094d0971f1f278ec87723a314af",
  )
    |> credential.with_delegation_key(
        #"07b90ff6d00550fd58e45042579522d52e782fb96d8d470d71b273a6",
      )
}

pub fn user_2_address() -> Address {
  credential.from_verification_key(
    #"2e526fdd5a3fcab6f91446feda8055bbecec40e84bd7d97000057164",
  )
    |> credential.with_delegation_key(
        #"4b91c17170fba8db83d80b69ad222554edefd284600ee7f5a9d903ff",
      )
}

pub fn user_3_address() -> Address {
  credential.from_verification_key(
    #"3ed315c64b3c16e79cc49198f40de796ee7cf7f3332ac8860427f773",
  )
    |> credential.with_delegation_key(
        #"cdde18bd3409b845709fd600aaf3fdf75851ef0c42bf299b0326d621",
      )
}

pub fn user_4_address() -> Address {
  credential.from_verification_key(
    #"b5fd4b89573f3404914d51fd2a4613ec23f72632da198dbb66180c86",
  )
    |> credential.with_delegation_key(
        #"ebe28d2fb90e75d03f46511d54580298fc2fd019f6a59b08d0274e32",
      )
}

pub fn user_5_address() -> Address {
  credential.from_verification_key(
    #"fbf7187e6318d7c42b8adeb923fd6893df76219a6e1cef6538f1cd51",
  )
    |> credential.with_delegation_key(
        #"0d40177417a500d2db7c925f3718240407469f600f111f001d286493",
      )
}

pub const two_hours_in_milliseconds: Int = 7200000

pub const one_hour_in_milliseconds: Int = 3600000

pub const whitelisted_price_1: Int = 150_000_000

pub const whitelisted_price_2: Int = 160_000_000
