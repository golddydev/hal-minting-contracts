use aiken/list
use aiken/transaction.{Output, Transaction}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value
use hal_nft_mint/minting_data.{find_minting_data}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/mint/utils.{check_mint_one_royalty_asset, check_royalty_output}

// Validation:
// Main validation logic for H.A.L. minting
//
// Checks
// - must attach `Settings` in reference inputs.
// - must spend `Minting Data` UTxO (with `Minting Data NFT`)
// - check that `Minting Data` UTxO is from `minting_data_script_hash` from `Settings`.
//
pub fn can_mint_nfts(transaction: Transaction) -> Bool {
  trace @"can_mint_nfts"
  let Transaction { inputs, reference_inputs, .. } = transaction

  // must attach `Settings` in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { minting_data_script_hash, .. } = settings_datum

  // minting_data asset is spent from minting_data_script from Settings
  let (minting_data_input, _) = find_minting_data(inputs)
  expect
    minting_data_input.address.payment_credential == ScriptCredential(
      minting_data_script_hash,
    )

  True
}

// Validation:
// When an admin mints royalty NFT
//
// Checks
// - must attach `Settings` in reference inputs.
// - must be signed by `allowed_minter` from `Settings`.
// - must mint only one Royalty NFT. See [CIP 102](https://cips.cardano.org/cip/CIP-0102)
// - Royalty NFT must be sent to `royalty_spend` spending validator.
//
pub fn can_mint_royalty_nft(transaction: Transaction) -> Bool {
  trace @"can_mint_royalty_nft"
  let Transaction { reference_inputs, outputs, mint, extra_signatories, .. } =
    transaction

  // must attach `Settings` in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { policy_id, allowed_minter, royalty_spend_script_hash, .. } =
    settings_datum

  // must be signed by `allowed_minter` from `Settings`.
  expect list.has(extra_signatories, allowed_minter)

  // must mint only one Royalty NFT. See [CIP 102](https://cips.cardano.org/cip/CIP-0102)
  let only_mint_one_royalty_asset =
    check_mint_one_royalty_asset(value.from_minted_value(mint), policy_id)
  expect only_mint_one_royalty_asset

  // Royalty NFT must be sent to `royalty_spend` spending validator.
  expect [royalty_output, ..] = outputs
  let is_royalty_output_valid =
    check_royalty_output(royalty_output, policy_id, royalty_spend_script_hash)
  expect is_royalty_output_valid

  True
}
