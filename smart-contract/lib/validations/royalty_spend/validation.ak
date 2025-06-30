use aiken/dict
use aiken/list
use aiken/transaction.{InlineDatum, Output, OutputReference, Transaction}
use aiken/transaction/credential
use aiken/transaction/value
use common/royalty.{RoyaltyDatum, royalty_asset_full_name}
use common/utils.{get_own_script_hash, get_own_utxo, get_own_utxos_count}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}

// Validation:
// When user updates H.A.L. NFT's datum.
//
// Checks:
// - must attach `Settings` NFT in reference inputs.
// - must be signed by `allowed_minter` from `Settings`.
// - spending UTxO must have only one Royalty Token.
// - there must be only one UTxO in transaction inputs from this script.
// - first output must be royalty output.
//
pub fn can_update(
  transaction: Transaction,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, outputs, reference_inputs, extra_signatories, .. } =
    transaction

  // must attach `Settings` NFT in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 {
    policy_id: hal_policy_id,
    allowed_minter,
    royalty_spend_script_hash,
    ..
  } = settings_datum

  // must be signed by `allowed_minter` from `Settings`.
  let is_signed_by_allowed_minter = list.has(extra_signatories, allowed_minter)
  expect is_signed_by_allowed_minter

  // spending UTxO must have only one Royalty Token.
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let Output { address: own_utxo_address, value: own_utxo_value, .. } = own_utxo
  let hal_tokens =
    own_utxo_value |> value.tokens(hal_policy_id) |> dict.to_pairs
  let has_only_one_royalty_token =
    hal_tokens == [Pair(royalty_asset_full_name, 1)]
  expect has_only_one_royalty_token

  // there must be only one UTxO in transaction inputs from this script.
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxos_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxos_count == 1

  // first output must be royalty output.
  expect [royalty_output, ..] = outputs
  let Output {
    address: output_address,
    datum: output_datum,
    value: output_value,
    reference_script: output_reference_script,
  } = royalty_output

  // royalty output address must stay same or be royalty_spend_script_hash
  let is_royalty_output_address_valid = or {
      output_address == own_utxo_address,
      output_address == credential.from_script(royalty_spend_script_hash),
    }
  expect is_royalty_output_address_valid

  // datum must be RoyaltyDatum (as inline datum)
  expect InlineDatum(output_datum) = output_datum
  expect _output_datum: RoyaltyDatum = output_datum

  // must not spend any asset
  let value_stay_same =
    value.without_lovelace(output_value) == value.without_lovelace(
      own_utxo_value,
    )
  expect value_stay_same

  // reference script must be none
  expect output_reference_script == None

  True
}

// Validation:
// When user (or admin) migrates reference asset to latest `ref_spend` spending validator.
//
// Checks:
// - must attach `Settings` NFT in reference inputs.
// - there must be only one UTxO in transaction inputs from this script.
// - first output must be royalty_output.
//
pub fn can_migrate(
  transaction: Transaction,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, outputs, reference_inputs, .. } = transaction

  // must attach `Settings` NFT in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { royalty_spend_script_hash, .. } = settings_datum

  // there must be only one UTxO in transaction inputs from this script.
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxos_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxos_count == 1

  // first output must be royalty_output.
  expect [royalty_output, ..] = outputs
  let Output {
    address: output_address,
    value: output_value,
    datum: output_datum,
    reference_script: output_reference_script,
  } = royalty_output
  let Output { value: own_utxo_value, datum: own_utxo_datum, .. } = own_utxo

  // output address must be royalty_spend_script_hash
  let is_royalty_output_address_valid =
    output_address == credential.from_script(royalty_spend_script_hash)
  expect is_royalty_output_address_valid

  // value must stay same
  let value_stay_same = output_value == own_utxo_value
  expect value_stay_same

  // datum must stay same
  let is_datum_stay_same = output_datum == own_utxo_datum
  expect is_datum_stay_same

  // reference script must be none
  expect output_reference_script == None

  True
}
