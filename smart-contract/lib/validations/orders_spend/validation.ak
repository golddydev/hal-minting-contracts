use aiken/list
use aiken/transaction.{OutputReference, Transaction}
use aiken/transaction/value.{PolicyId}
use common/utils.{get_own_script_hash, get_own_utxo, get_own_utxos_count}
use hal_nft_mint/orders.{OrderDatum, order_asset_name}

// Validation:
// When minting engine spends Orders UTxO and burns Orders NFTs
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
// - must burn only one Order NFT
//
pub fn can_cancel_order(
  transaction: Transaction,
  datum: OrderDatum,
  spending_output_reference: OutputReference,
  orders_mint_policy_id: PolicyId,
) -> Bool {
  let Transaction { inputs, extra_signatories, mint, .. } = transaction

  // must be signed by owner of Order
  let is_owner_signed = list.has(extra_signatories, datum.owner_key_hash)
  expect is_owner_signed

  // there must be only one UTxO from this script
  let own_utxo = get_own_utxo(inputs, spending_output_reference)
  let own_script_hash = get_own_script_hash(own_utxo)
  let own_utxo_count = get_own_utxos_count(inputs, own_script_hash)
  expect own_utxo_count == 1

  // must burn only one Order NFT
  let expected_mint_value =
    value.zero()
      |> value.add(orders_mint_policy_id, order_asset_name, -1)
  let is_order_burnt = value.from_minted_value(mint) == expected_mint_value
  expect is_order_burnt

  True
}
