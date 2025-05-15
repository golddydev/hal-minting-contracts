use aiken/bytearray
use aiken/dict
use aiken/list
use aiken/transaction.{Output, OutputReference, Transaction}
use aiken/transaction/value.{AssetName}
use common/cip68.{prefix_100, prefix_222}
use common/utils.{get_own_script_hash,
  get_own_utxo, get_own_utxos_count} as common_utils
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/cip68/utils.{does_spend_user_asset}

// Validation:
// When user tries to update H.A.L. NFT datum
//
// Checks:
// - must attach Settings in reference inputs
// - must be signed by cip68_admin
// - spending UTxO must have only one reference asset with asset_name from redeemer
// - there must be H.A.L. user asset in transaction inputs
// - there must be only one UTxO spending in inputs from this script
// - first output must be UTxO with reference asset with same value
//
pub fn can_update(
  transaction: Transaction,
  spending_output_reference: OutputReference,
  asset_name: AssetName,
) -> Bool {
  let Transaction { inputs, outputs, reference_inputs, extra_signatories, .. } =
    transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 {
    policy_id: hal_policy_id,
    cip68_script_address,
    cip68_admin,
    ..
  } = settings_datum

  // must be signed by cip68_admin
  let is_signed_by_cip68_admin = list.has(extra_signatories, cip68_admin)
  expect is_signed_by_cip68_admin

  // make ref asset name and user asset name from asset_name
  let ref_asset_name = bytearray.concat(prefix_100, asset_name)
  let user_asset_name = bytearray.concat(prefix_222, asset_name)

  // spending UTxO must have only one reference asset with asset_name from redeemer
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let Output { address: own_utxo_address, value: own_utxo_value, .. } = own_utxo
  let hal_tokens =
    own_utxo_value |> value.tokens(hal_policy_id) |> dict.to_pairs
  let has_only_one_ref_asset = hal_tokens == [Pair(ref_asset_name, 1)]
  expect has_only_one_ref_asset

  // there must be H.A.L. user asset in transaction inputs
  let is_spending_user_asset =
    does_spend_user_asset(inputs, hal_policy_id, user_asset_name)
  expect is_spending_user_asset

  // there must be only one UTxO spending in inputs from this script
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxos_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxos_count == 1

  // first output must be UTxO with reference asset with same value
  expect [output, ..] = outputs
  let Output {
    address: output_address,
    value: output_value,
    reference_script: output_reference_script,
    ..
  } = output
  // output address must stay same or be cip68_script_address
  let is_output_address_valid = or {
      output_address == own_utxo_address,
      output_address == cip68_script_address,
    }
  expect is_output_address_valid
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
// When user tries to migrate H.A.L. NFT to 
// latest cip68_script_address
//
// Checks:
// - must attach Setting in reference inputs
// - first output must be UTxO with reference asset to cip68_script_address
//   with same value and datum as spending UTxO
//
pub fn can_migrate(
  transaction: Transaction,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, outputs, reference_inputs, .. } = transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { cip68_script_address, .. } = settings_datum

  // first output must be UTxO with reference asset to cip68_script_address
  // with same value and datum as spending UTxO
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let Output { value: own_utxo_value, datum: own_utxo_datum, .. } = own_utxo
  expect [output, ..] = outputs
  let Output {
    address: output_address,
    value: output_value,
    datum: output_datum,
    reference_script: output_reference_script,
  } = output
  // output address must be cip68_script_address
  let is_output_address_valid = output_address == cip68_script_address
  expect is_output_address_valid
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
