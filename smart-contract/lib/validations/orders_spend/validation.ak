use aiken/list
use aiken/transaction.{Output, OutputReference, Transaction}
use aiken/transaction/value.{PolicyId}
use common/utils.{get_own_script_hash,
  get_own_utxo, get_own_utxos_count} as common_utils
use hal_nft_mint/orders.{OrderDatum}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/orders_spend/utils.{is_refunded_output_address_valid}

// Validation:
// When minting engine spends Orders UTxO
//
// Checks:
// - must mint H.A.L. NFT(s)
//
pub fn can_execute_orders(
  transaction: Transaction,
  hal_policy_id: PolicyId,
) -> Bool {
  let Transaction { mint, .. } = transaction

  // must mint H.A.L. NFT(s)
  // (because H.A.L. burn is not supported, we don't check amount)
  let is_hal_minted =
    mint |> value.from_minted_value |> value.policies |> list.has(hal_policy_id)
  expect is_hal_minted

  True
}

// Validation:
// When user tries to cancel Order
//
// Checks:
// - must be signed by owner of Order
// - there must be only one UTxO from this script
//
pub fn can_cancel_order(
  transaction: Transaction,
  datum: OrderDatum,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, extra_signatories, .. } = transaction

  // must be signed by owner of Order
  let is_owner_signed = list.has(extra_signatories, datum.owner_key_hash)
  expect is_owner_signed

  // there must be only one UTxO from this script
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  True
}

// Validation:
// When admin tries to refund Order
//
// Checks:
// - must attach Setting in reference inputs
// - must be signed by allowed_minter
// - there must be only one UTxO from this script
// - first output must be Refunded to Output to owner in Order Datum
//   with enough lovelace (Own UTxO - Fee)
//
pub fn can_refund_order(
  transaction: Transaction,
  datum: OrderDatum,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    fee,
    extra_signatories,
    ..
  } = transaction

  // parse order datum
  let OrderDatum { owner_key_hash, .. } = datum

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { allowed_minter, .. } = settings_datum

  // must be signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // there must be only one UTxO from this script
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  // first output must be Refunded to Output to owner in Order Datum
  // with enough lovelace (Own UTxO - Fee)
  expect [refunded_output, ..] = outputs
  let Output { address: refunded_address, value: refunded_value, .. } =
    refunded_output

  // check address
  let is_refunded_address_valid =
    is_refunded_output_address_valid(refunded_address, owner_key_hash)
  expect is_refunded_address_valid

  // check value
  let Output { value: own_utxo_value, .. } = own_utxo
  let expected_lovelace =
    value.lovelace_of(own_utxo_value) - value.lovelace_of(fee)
  let is_refunded_value_enough =
    value.lovelace_of(refunded_value) >= expected_lovelace
  expect is_refunded_value_enough

  True
}
