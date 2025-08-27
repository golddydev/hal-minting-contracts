use aiken/list
use aiken/transaction.{Output, OutputReference, Transaction}
use aiken/transaction/value.{PolicyId}
use common/utils.{get_own_utxo,
  get_own_utxos_count, get_script_hash_from_utxo} as common_utils
use hal_nft_mint/orders.{OrderDatum}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/orders_spend/utils.{
  get_owner_key_hash_from_datum, is_refunded_output_address_valid,
}

// Validation:
// When minting engine mints H.A.L. NFTs spending `Order UTxOs` from this script.
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
// When an user cancels his Order.
//
// Checks:
// - `datum` must be type of `OrderDatum`.
// - transaction must be signed by `owner_key_hash` from `OrderDatum`.
// - there must be only one UTxO in transaction inputs from this script.
//
pub fn can_cancel_order(
  transaction: Transaction,
  datum: Data,
  spending_output_reference: OutputReference,
) -> Bool {
  let Transaction { inputs, extra_signatories, .. } = transaction

  // `datum` must be type of `OrderDatum`.
  expect datum: OrderDatum = datum

  // transaction must be signed by `owner_key_hash` from `OrderDatum`.
  let is_owner_signed = list.has(extra_signatories, datum.owner_key_hash)
  expect is_owner_signed

  // there must be only one UTxO in transaction inputs from this script.
  let own_script_hash =
    get_own_utxo(inputs, spending_output_reference) |> get_script_hash_from_utxo
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  True
}

// Validation:
// When admin refunds Order UTxO to user.
//
// Checks:
// - must attach `Settings` NFT in reference inputs.
// - must be signed by `allowed_minter` from `Settings`.
// - there must be only one UTxO in transaction inputs from this script.
// - first output must be refunded output.
//   output value must be greater than or equal to spending UTxO.
//   must be sent to `owner_key_hash` if datum is typeof `OrderDatum`.
//
pub fn can_refund_order(
  transaction: Transaction,
  datum: Data,
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

  // must attach `Settings` NFT in reference inputs.
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 { allowed_minter, .. } = settings_datum

  // must be signed by `allowed_minter` from `Settings`.
  expect list.has(extra_signatories, allowed_minter)

  // there must be only one UTxO in transaction inputs from this script
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_script_hash_from_utxo(own_utxo)
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  // first output must be refunded output.
  expect [refunded_output, ..] = outputs
  let Output { address: refunded_address, value: refunded_value, .. } =
    refunded_output

  // output value must be greater than or equal to spending UTxO.
  let Output { value: own_utxo_value, .. } = own_utxo
  let expected_lovelace =
    value.lovelace_of(own_utxo_value) - value.lovelace_of(fee)
  let is_refunded_value_enough =
    value.lovelace_of(refunded_value) >= expected_lovelace
  expect is_refunded_value_enough

  // must be sent to `owner_key_hash` if datum is typeof `OrderDatum`.
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
