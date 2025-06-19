use aiken/list
use aiken/transaction.{Output, Transaction}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value
use common/hashes.{ScriptHash}
use hal_nft_mint/minting_data.{find_minting_data}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/mint_v1/utils.{
  check_mint_one_royalty_asset, check_royalty_output,
}

// Validation:
// Main validation logic for new handles' minting
//
// Checks
// - minting_data asset is spent from minting_data_script from parameter
//
pub fn can_mint_nfts(
  transaction: Transaction,
  minting_data_script_hash: ScriptHash,
) -> Bool {
  trace @"can_mint_nfts"
  let Transaction { inputs, .. } = transaction

  // minting_data asset is spent from minting_data_script from parameter
  let (minting_data_input, _) = find_minting_data(inputs)
  expect
    minting_data_input.address.payment_credential == ScriptCredential(
      minting_data_script_hash,
    )

  True
}

// Validation:
// When admin mint royalty NFTs
//
// Checks
// - must attach Setting in reference inputs
// - must be signed by allowed_minter
// - must mint only 1 royalty NFT
// - royalty NFT must be sent to royalty_spend script address
//
pub fn can_mint_royalty_nft(transaction: Transaction) -> Bool {
  trace @"can_mint_royalty_nft"
  let Transaction { reference_inputs, outputs, mint, extra_signatories, .. } =
    transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { policy_id, allowed_minter, royalty_spend_script_address, .. } =
    settings_datum

  // must be signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // must mint only 1 royalty NFT
  let only_mint_one_royalty_asset =
    check_mint_one_royalty_asset(value.from_minted_value(mint), policy_id)
  expect only_mint_one_royalty_asset

  // royalty NFT must be sent to royalty_spend script address
  expect [royalty_output, ..] = outputs
  let is_royalty_output_valid =
    check_royalty_output(
      royalty_output,
      policy_id,
      royalty_spend_script_address,
    )
  expect is_royalty_output_valid

  True
}
