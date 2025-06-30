use aiken/bytearray
use aiken/dict
use aiken/list
use aiken/transaction.{InlineDatum, Input, Output}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value.{AssetName, PolicyId, Value}
use common/cip68.{CIP68Datum, prefix_100, prefix_222}
use common/hashes.{ScriptHash}
use common/utils.{bytearray_starts_with}

// must spend H.A.L. User Asset whose name is `asset_name` from redeemer.
pub fn does_spend_user_asset(
  inputs: List<Input>,
  hal_policy_id: PolicyId,
  asset_name: AssetName,
) -> Bool {
  let user_asset_name = bytearray.concat(prefix_222, asset_name)
  inputs
    |> list.any(
        fn(input: Input) -> Bool {
          let Input { output: Output { value: v, .. }, .. } = input
          let has_user_asset =
            ( v |> value.quantity_of(hal_policy_id, user_asset_name) ) == 1
          has_user_asset
        },
      )
}

// there must be only one transaction input with H.A.L. Reference Asset.
pub fn has_only_one_utxo_with_ref_asset(
  inputs: List<Input>,
  hal_policy_id: PolicyId,
) -> Output {
  let ref_spend_proxy_inputs =
    list.filter(
      inputs,
      fn(input) {
        let Input { output: Output { value, .. }, .. } = input
        does_value_have_reference_assets(value, hal_policy_id)
      },
    )

  expect [ref_spend_proxy_input] = ref_spend_proxy_inputs

  ref_spend_proxy_input.output
}

fn does_value_have_reference_assets(v: Value, hal_policy_id: PolicyId) -> Bool {
  v
    |> value.tokens(hal_policy_id)
    |> dict.keys
    |> list.any(fn(asset_name) { bytearray_starts_with(asset_name, prefix_100) })
}

// This function checks:
//
// - must be from `ref_spend_proxy_script_hash` from `Settings`.
// - must have only one H.A.L. Reference Asset. (asset_name)
// - must NOT have reference script.
// - must have datum type of `CIP68Datum`.
//
pub fn resolve_ref_spend_proxy_output_datum(
  output: Output,
  ref_spend_proxy_script_hash: ScriptHash,
  hal_policy_id: PolicyId,
  asset_name: AssetName,
) -> CIP68Datum {
  let Output {
    address: output_address,
    value: output_value,
    datum: output_datum,
    reference_script: output_reference_script,
  } = output
  let Address { payment_credential, .. } = output_address

  // must be from `ref_spend_proxy_script_hash` from `Settings`.
  let is_ref_spend_proxy_output_address_valid =
    payment_credential == ScriptCredential(ref_spend_proxy_script_hash)
  expect is_ref_spend_proxy_output_address_valid

  // must have only one H.A.L. Reference Asset. (asset_name)
  let ref_asset_name = bytearray.concat(prefix_100, asset_name)
  let expected_value =
    value.zero() |> value.add(hal_policy_id, ref_asset_name, 1)
  let has_only_one_ref_asset =
    value.without_lovelace(output_value) == expected_value
  expect has_only_one_ref_asset

  // must NOT have reference script.
  expect output_reference_script == None

  // must have datum type of `CIP68Datum`.
  expect InlineDatum(output_datum) = output_datum
  expect output_datum: CIP68Datum = output_datum

  output_datum
}
