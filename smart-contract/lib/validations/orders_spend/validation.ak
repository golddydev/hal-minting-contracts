use aiken/list
use aiken/transaction.{OutputReference, Transaction}
use aiken/transaction/value.{PolicyId}
use common/utils.{get_own_script_hash, get_own_utxo, get_own_utxos_count}
use hal_nft_mint/orders.{OrderDatum}

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
