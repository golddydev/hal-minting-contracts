use aiken/bytearray
use aiken/cbor.{serialise}
use aiken/dict
use aiken/interval.{is_entirely_after}
use aiken/list
use aiken/math
use aiken/merkle_patricia_forestry as mpt
use aiken/pairs
use aiken/transaction.{InlineDatum, Input, Output, ValidityRange}
use aiken/transaction/credential.{Address, ScriptCredential}
use aiken/transaction/value.{AssetName, PolicyId, Value}
use common/cip68.{prefix_100, prefix_222}
use common/hashes.{ScriptHash}
use common/utils.{get_tx_start_time}
use hal_nft_mint/minting_data.{mpt_minted_value}
use hal_nft_mint/orders.{Order, OrderDatum}
use hal_nft_mint/whitelist.{WhitelistedItem, WhitelistedValue}
use validations/minting_data/types.{AssetNameProof, Proofs, WhitelistProof}

// This function checks if all orders are fulfilled correctly
// - all orders (all UTxOs in transaction inputs) are fulfilled correctly
//   each aggregated order must have one user output
//   user output must have `amount` of H.A.L. User NFT
// - update mpt root with asset_name_proofs (which contains asset names and mpt proofs)
// - update whitelist mpt root with whitelist_proof_opt
//
// Returns: (updated_mpt_root, updated_whitelist_mpt_root, hal_asset_names, total_spent_lovelace)
//
pub fn are_all_orders_fulfilled(
  aggregated_orders: List<Order>,
  user_outputs: List<Output>,
  root: mpt.MerklePatriciaForestry,
  whitelist_root: mpt.MerklePatriciaForestry,
  hal_asset_names: List<AssetName>,
  total_spent_lovelace: Int,
  policy_id: PolicyId,
  hal_nft_price: Int,
  validity_range: ValidityRange,
  minting_start_time: Int,
  proofs_list: List<Proofs>,
  continuation: fn(
    mpt.MerklePatriciaForestry,
    mpt.MerklePatriciaForestry,
    List<AssetName>,
    Int,
  ) ->
    result,
) -> result {
  when aggregated_orders is {
    [] ->
      continuation(root, whitelist_root, hal_asset_names, total_spent_lovelace)
    [aggregated_order, ..rest_aggregated_orders] -> {
      let (destination_address, ordered_amount) = aggregated_order

      // parse user outputs
      expect [user_output, ..rest_user_outputs] = user_outputs

      // parse proofs
      expect [proofs, ..rest_proofs_list] = proofs_list
      let (asset_name_proofs, whitelist_proof_opt) = proofs

      // update mpt root
      let new_root = update_mpt_root(root, asset_name_proofs)

      // update whitelist mpt root
      // if whitelist_proof_opt is None,
      let (
        new_whitelist_root,
        remaining_ordered_amount,
        spent_lovelace_for_whitelisted,
      ) =
        when whitelist_proof_opt is {
          None -> (whitelist_root, ordered_amount, 0)
          Some(whitelist_proof) ->
            update_whitelist_mpt_root(
              whitelist_root,
              whitelist_proof,
              validity_range,
              minting_start_time,
              destination_address,
              ordered_amount,
            )
        }

      // check if there is any remaining_ordered_amount
      // if so, it means that we can't mint all ordered_amount as whitelisted
      // and must mint after minting_start_time
      // and add hal_nft_price * remaining_ordered_amount to spent_lovelace_for_whitelisted
      let spent_lovelace_for_ordered_amount =
        if remaining_ordered_amount > 0 {
          trace @"couldn't mint all as whitelisted"
          let is_after_minting_start_time =
            is_entirely_after(validity_range, minting_start_time)
          expect is_after_minting_start_time

          spent_lovelace_for_whitelisted + hal_nft_price * remaining_ordered_amount
        } else {
          spent_lovelace_for_whitelisted
        }
      let new_total_spent_lovelace =
        total_spent_lovelace + spent_lovelace_for_ordered_amount

      // filter asset names
      let asset_names =
        list.map(
          asset_name_proofs,
          fn(asset_name_proof) { asset_name_proof.1st },
        )

      // check user output
      let is_user_output_valid =
        check_user_output(
          user_output,
          destination_address,
          asset_names,
          policy_id,
        )
      expect is_user_output_valid

      // new hal asset names
      let new_hal_asset_names = list.concat(hal_asset_names, asset_names)

      are_all_orders_fulfilled(
        rest_aggregated_orders,
        rest_user_outputs,
        new_root,
        new_whitelist_root,
        new_hal_asset_names,
        new_total_spent_lovelace,
        policy_id,
        hal_nft_price,
        validity_range,
        minting_start_time,
        rest_proofs_list,
        continuation,
      )
    }
  }
}

pub fn update_mpt_root(
  root: mpt.MerklePatriciaForestry,
  proofs: List<AssetNameProof>,
) -> mpt.MerklePatriciaForestry {
  trace @"update_mpt_root"
  when proofs is {
    [] -> root
    [(asset_name, mpt_proof), ..rest_proofs] -> {
      let new_root =
        root |> mpt.update(asset_name, mpt_proof, #"", mpt_minted_value)
      update_mpt_root(new_root, rest_proofs)
    }
  }
}

// This function updates whitelisted_mpt
// where key is destination_address
// We spend whitelisted value's amount as much as we can agains ordered_amount
// and for those amounts, price will be discounted (those costs will be added to spent_lovelace_for_whitelisted)
//
// Returns: (updated_whitelisted_mpt, remaining_ordered_amount, spent_lovelace_for_whitelisted)
//
pub fn update_whitelist_mpt_root(
  root: mpt.MerklePatriciaForestry,
  whitelist_proof: WhitelistProof,
  validity_range: ValidityRange,
  minting_start_time: Int,
  destination_address: Address,
  ordered_amount: Int,
) -> (mpt.MerklePatriciaForestry, Int, Int) {
  trace @"update_whitelist_mpt_root"
  let (old_whitelisted_value, mpt_proof) = whitelist_proof

  let tx_start_time = get_tx_start_time(validity_range)
  let tx_time_gap = minting_start_time - tx_start_time

  // update whitelisted value
  let (
    new_whitelisted_value,
    remaining_ordered_amount,
    spent_lovelace_for_whitelisted,
  ) =
    update_whitelisted_value(
      old_whitelisted_value,
      [],
      ordered_amount,
      0,
      tx_time_gap,
    )

  // update root
  let whitelisted_key_cbor = serialise(destination_address)
  let old_value_cbor = serialise(old_whitelisted_value)
  let new_value_cbor = serialise(new_whitelisted_value)

  let new_root =
    root
      |> mpt.update(
          whitelisted_key_cbor,
          mpt_proof,
          old_value_cbor,
          new_value_cbor,
        )
  (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted)
}

// This function updates whitelisted_value
// against the ordered_amount
//
// Spend whitelisted_item's amount (together reducing ordered_amount) if tx_time_gap
// is available with whitelisted_item's time_gap
// and collect whitelisted_item's price to spent_lovelace_for_whitelisted
//
// Returns: (new_whitelisted_value, remaining_ordered_amount, spent_lovelace_for_whitelisted)
//
pub fn update_whitelisted_value(
  whitelisted_value: WhitelistedValue,
  new_whitelisted_value: WhitelistedValue,
  remaining_ordered_amount: Int,
  spent_lovelace_for_whitelisted: Int,
  tx_time_gap: Int,
) -> (WhitelistedValue, Int, Int) {
  when whitelisted_value is {
    [] ->
      (
        new_whitelisted_value,
        remaining_ordered_amount,
        spent_lovelace_for_whitelisted,
      )
    [whitelisted_item, ..rest_whitelisted_items] -> {
      let WhitelistedItem { time_gap, amount, price: discounted_price } =
        whitelisted_item
      // check amount
      if amount <= 0 {
        update_whitelisted_value(
          rest_whitelisted_items,
          new_whitelisted_value,
          remaining_ordered_amount,
          spent_lovelace_for_whitelisted,
          tx_time_gap,
        )
      } else {
        // tx_time_gap is available with whitelisted_item's time_gap
        if tx_time_gap > time_gap {
          // if tx starts too early than whitelisted_time,
          // then we can't use this whitelisted_item
          update_whitelisted_value(
            rest_whitelisted_items,
            new_whitelisted_value |> list.concat([whitelisted_item]),
            remaining_ordered_amount,
            spent_lovelace_for_whitelisted,
            tx_time_gap,
          )
        } else {
          // if tx starts after whitelisted_time
          let available_amount = math.min(amount, remaining_ordered_amount)
          let new_amount = amount - available_amount
          let new_remaining_ordered_amount =
            remaining_ordered_amount - available_amount
          let new_spent_lovelace_for_whitelisted =
            spent_lovelace_for_whitelisted + discounted_price * available_amount

          let new_whitelisted_value =
            if new_amount <= 0 {
              // when we spend all whitelisted_item's amount
              // then we don't need to add it to new_whitelisted_value
              new_whitelisted_value
            } else {
              // when we don't spend all whitelisted_item's amount
              // then we need to add it to new_whitelisted_value
              let updated_whitelisted_item =
                WhitelistedItem {
                  time_gap,
                  amount: new_amount,
                  price: discounted_price,
                }
              new_whitelisted_value
                |> list.concat([updated_whitelisted_item])
            }

          // check if there is any remaining_ordered_amount
          if new_remaining_ordered_amount <= 0 {
            // when there is no remaining_ordered_amount
            // return current state
            (
              new_whitelisted_value |> list.concat(rest_whitelisted_items),
              0,
              new_spent_lovelace_for_whitelisted,
            )
          } else {
            update_whitelisted_value(
              rest_whitelisted_items,
              new_whitelisted_value,
              new_remaining_ordered_amount,
              new_spent_lovelace_for_whitelisted,
              tx_time_gap,
            )
          }
        }
      }
    }
  }
}

fn check_user_output(
  user_output: Output,
  destination_address: Address,
  asset_names: List<AssetName>,
  policy_id: PolicyId,
) -> Bool {
  let Output { address: user_output_address, value: user_output_value, .. } =
    user_output

  // check address
  expect user_output_address == destination_address

  // check value
  let hal_token_pairs =
    user_output_value |> value.tokens(policy_id) |> dict.to_pairs
  let has_all_assets =
    list.all(
      asset_names,
      fn(asset_name) -> Bool {
        let user_asset_name = bytearray.concat(prefix_222, asset_name)
        pairs.get_first(hal_token_pairs, user_asset_name) == Some(1)
      },
    )
  let has_no_other_hal_assets =
    list.length(hal_token_pairs) == list.length(asset_names)
  expect has_all_assets
  expect has_no_other_hal_assets

  True
}

pub fn check_ref_outputs(
  hal_asset_names: List<AssetName>,
  outputs: List<Output>,
  ref_spend_proxy_script_hash: ScriptHash,
  policy_id: PolicyId,
) -> Bool {
  when hal_asset_names is {
    [] -> True
    [hal_asset_name, ..rest_hal_asset_names] -> {
      let ref_asset_name = bytearray.concat(prefix_100, hal_asset_name)
      expect [output, ..rest_outputs] = outputs
      let Output {
        address: output_address,
        value: output_value,
        reference_script: output_reference_script,
        ..
      } = output

      // check address
      let is_ref_output_address_valid =
        output_address == credential.from_script(ref_spend_proxy_script_hash)
      expect is_ref_output_address_valid

      // check value
      let expected_value =
        value.zero() |> value.add(policy_id, ref_asset_name, 1)
      let has_ref_asset = value.without_lovelace(output_value) == expected_value
      expect has_ref_asset

      // check reference script
      expect output_reference_script == None

      check_ref_outputs(
        rest_hal_asset_names,
        rest_outputs,
        ref_spend_proxy_script_hash,
        policy_id,
      )
    }
  }
}

pub fn check_hal_tokens_minted(
  hal_asset_names: List<AssetName>,
  minted_value: Value,
  policy_id: PolicyId,
) -> Bool {
  let minted_hal_tokens = value.tokens(minted_value, policy_id)

  let are_all_hal_tokens_minted =
    list.all(
      hal_asset_names,
      fn(hal_asset_name) -> Bool {
        let ref_asset_name = bytearray.concat(prefix_100, hal_asset_name)
        let user_asset_name = bytearray.concat(prefix_222, hal_asset_name)
        let is_ref_asset_minted =
          dict.get(minted_hal_tokens, ref_asset_name) == Some(1)
        let is_user_asset_minted =
          dict.get(minted_hal_tokens, user_asset_name) == Some(1)
        expect is_ref_asset_minted
        expect is_user_asset_minted
        True
      },
    )
  let no_other_hal_tokens_minted =
    dict.size(minted_hal_tokens) == list.length(hal_asset_names) * 2

  expect are_all_hal_tokens_minted
  expect no_other_hal_tokens_minted

  True
}

// This function returns aggregated orders information
// if there are more than 1 Order UTxO with same destinationAddress
// those will be aggregated with sum of amounts
// and return total paid lovelace: The sum of lovelace of all Order UTxOs
//
pub fn aggregate_orders_information(
  inputs: List<Input>,
  aggregated_orders: List<Order>,
  total_paid_lovelace: Int,
  orders_spend_script_hash: ScriptHash,
  continuation: fn(List<Order>, Int) -> result,
) -> result {
  when inputs is {
    [] -> continuation(aggregated_orders, total_paid_lovelace)
    [order_input, ..rest_inputs] -> {
      let Output {
        address: Address { payment_credential, .. },
        datum,
        value: order_input_value,
        ..
      } = order_input.output

      let is_order =
        payment_credential == ScriptCredential(orders_spend_script_hash)
      when is_order is {
        True -> {
          // parse order datum
          expect InlineDatum(datum) = datum
          expect order_datum: OrderDatum = datum
          let OrderDatum { destination_address, amount, .. } = order_datum

          // sum up to total paid lovelace
          let new_total_paid_lovelace =
            total_paid_lovelace + value.lovelace_of(order_input_value)

          aggregate_orders_information(
            rest_inputs,
            add_order_to_aggregated_orders(
              aggregated_orders,
              destination_address,
              amount,
            ),
            new_total_paid_lovelace,
            orders_spend_script_hash,
            continuation,
          )
        }
        False ->
          aggregate_orders_information(
            rest_inputs,
            aggregated_orders,
            total_paid_lovelace,
            orders_spend_script_hash,
            continuation,
          )
      }
    }
  }
}

fn add_order_to_aggregated_orders(
  self: List<Order>,
  address: Address,
  amount: Int,
) -> List<Order> {
  when self is {
    [] ->
      [(address, amount)]
    [(address2, amount2), ..rest] ->
      if address == address2 {
        [(address, amount + amount2), ..rest]
      } else {
        [
          (address2, amount2),
          ..add_order_to_aggregated_orders(rest, address, amount)
        ]
      }
  }
}

// This function sorts aggregated orders
// by their destination address's cbor hex
//
pub fn sort_aggregated_orders(self: List<Order>) -> List<Order> {
  self
    |> list.sort(
        fn(a, b) { bytearray.compare(serialise(a.1st), serialise(b.1st)) },
      )
}
