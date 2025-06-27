use aiken/list
use aiken/transaction.{Transaction}
use aiken/transaction/value.{AssetName}
use common/hashes.{VerificationKeyHash}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/ref_spend/utils.{
  does_spend_user_asset, has_only_one_utxo_with_ref_asset,
  resolve_ref_spend_proxy_output_datum,
}

// Validation:
// When user updates H.A.L. NFT's datum.
//
// Checks:
// - must attach `Settings` NFT in reference inputs.
// - must be signed by `ref_spend_admin` from parameter.
// - must spend H.A.L. User Asset whose name is `asset_name` from redeemer.
// - there must be only one transaction input with H.A.L. Reference Asset.
// - the first output must be `reference_output`.
//
pub fn can_update(
  transaction: Transaction,
  ref_spend_admin: VerificationKeyHash,
  asset_name: AssetName,
) -> Bool {
  let Transaction { inputs, reference_inputs, outputs, extra_signatories, .. } =
    transaction

  // must attach `Settings` NFT in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { policy_id: hal_policy_id, ref_spend_proxy_script_hash, .. } =
    settings_datum

  // must be signed by `ref_spend_admin` from parameter.
  expect list.has(extra_signatories, ref_spend_admin)

  // must spend H.A.L. User Asset whose name is `asset_name` from redeemer.
  let spend_user_asset =
    does_spend_user_asset(inputs, hal_policy_id, asset_name)
  expect spend_user_asset

  // there must be only one transaction input with H.A.L. Reference Asset.
  let ref_spend_proxy_utxo =
    has_only_one_utxo_with_ref_asset(inputs, hal_policy_id)
  let old_datum =
    resolve_ref_spend_proxy_output_datum(
      ref_spend_proxy_utxo,
      ref_spend_proxy_script_hash,
      hal_policy_id,
      asset_name,
    )

  // the first output must be `reference_output`.
  expect [ref_spend_proxy_output, ..] = outputs
  let new_datum =
    resolve_ref_spend_proxy_output_datum(
      ref_spend_proxy_output,
      ref_spend_proxy_script_hash,
      hal_policy_id,
      asset_name,
    )

  let datum_changed = old_datum != new_datum
  expect datum_changed

  True
}
