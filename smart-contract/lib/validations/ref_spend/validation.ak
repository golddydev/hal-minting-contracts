use aiken/bytearray
use aiken/dict
use aiken/list
use aiken/transaction.{InlineDatum, Output, OutputReference, Transaction}
use aiken/transaction/credential
use aiken/transaction/value.{AssetName}
use common/cip68.{CIP68Datum, prefix_100, prefix_222}
use common/utils.{get_own_script_hash,
  get_own_utxo, get_own_utxos_count} as common_utils
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/ref_spend/utils.{does_spend_user_asset}

// Validation:
// When user updates H.A.L. NFT's datum.
//
// Checks:
// - must attach `Settings` NFT in reference inputs.
// - must be signed by `ref_spend_admin` from `Settings`.
// - spending UTxO must have only one reference asset with `asset_name` from redeemer.
// - there must be H.A.L. user asset in transaction inputs.
// - there must be only one UTxO in transaction inputs from this script.
// - first output must be reference output.
//
pub fn can_update(transaction: Transaction) -> Bool {
  todo
}
