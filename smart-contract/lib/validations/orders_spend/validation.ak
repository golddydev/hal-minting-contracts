use aiken/list
use aiken/transaction.{Output, OutputReference, Transaction}
use aiken/transaction/value.{PolicyId}
use common/utils.{get_own_script_hash,
  get_own_utxo, get_own_utxos_count} as common_utils
use hal_nft_mint/orders.{OrderDatum}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/orders_spend/utils.{
  get_owner_key_hash_from_datum, is_refunded_output_address_valid,
}

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
// - there must be only one UTxO in transaction inputs from this script
//
pub fn can_cancel_order(
  transaction: Transaction,
  datum: Data,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, extra_signatories, .. } = transaction

  // expect OrderDatum
  expect datum: OrderDatum = datum

  // must be signed by owner of Order
  let is_owner_signed = list.has(extra_signatories, datum.owner_key_hash)
  expect is_owner_signed

  // there must be only one UTxO in transaction inputs from this script
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
// - there must be only one UTxO in transaction inputs from this script
// - output in output_index must be Refunded Output with enough lovelace (Own UTxO - Fee)
//   must be sent to owner_key_hash if datum is valid
// 
//
pub fn can_refund_order(
  transaction: Transaction,
  datum: Data,
  spending_output_reference: OutputReference,
  output_index: Int,
) -> Bool {
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    fee,
    extra_signatories,
    ..
  } = transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { allowed_minter, .. } = settings_datum

  // must be signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // output in output_index must be Refunded Output
  expect Some(refunded_output) = list.at(outputs, output_index)
  let Output { address: refunded_address, value: refunded_value, .. } =
    refunded_output

  // there must be only one UTxO in transaction inputs from this script
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  // check value
  let Output { value: own_utxo_value, .. } = own_utxo
  let expected_lovelace =
    value.lovelace_of(own_utxo_value) - value.lovelace_of(fee)
  let is_refunded_value_enough =
    value.lovelace_of(refunded_value) >= expected_lovelace
  expect is_refunded_value_enough

  // must be sent to owner_key_hash if datum is valid
  let owner_key_hash_opt = get_owner_key_hash_from_datum(datum)
  when owner_key_hash_opt is {
    Some(owner_key_hash) -> {
      let is_refunded_address_valid =
        is_refunded_output_address_valid(refunded_address, owner_key_hash)
      expect is_refunded_address_valid

      True
    }
    None -> True
  }
}
