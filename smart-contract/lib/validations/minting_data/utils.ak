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

// - all orders (all UTxOs in transaction inputs) are fulfilled correctly
//   each aggregated order must have one user output
//   user output must have `amount` of H.A.L. User NFT
//
pub fn are_all_orders_fulfilled(
  aggregated_orders: List<Order>,
  user_outputs: List<Output>,
  root: mpt.MerklePatriciaForestry,
  whitelist_root: mpt.MerklePatriciaForestry,
  hal_asset_names: List<AssetName>,
  policy_id: PolicyId,
  validity_range: ValidityRange,
  minting_start_time: Int,
  proofs_list: List<Proofs>,
  continuation: fn(
    mpt.MerklePatriciaForestry,
    mpt.MerklePatriciaForestry,
    List<AssetName>,
  ) ->
    result,
) -> result {
  when aggregated_orders is {
    [] -> continuation(root, whitelist_root, hal_asset_names)
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
      // and check whitelisted or not with tx validity range
      let new_whitelist_root =
        when whitelist_proof_opt is {
          None -> {
            // tx must starts after minting start time
            let is_after_minting_start_time =
              is_entirely_after(validity_range, minting_start_time)
            expect is_after_minting_start_time

            whitelist_root
          }
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
        policy_id,
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

// this function also checks
// the destination_address is whitelisted with time_gap
// to mint early
// and check minting start time and whitelisted amount
//
pub fn update_whitelist_mpt_root(
  root: mpt.MerklePatriciaForestry,
  whitelist_proof: WhitelistProof,
  validity_range: ValidityRange,
  minting_start_time: Int,
  destination_address: Address,
  ordered_amount: Int,
) -> mpt.MerklePatriciaForestry {
  trace @"update_whitelist_mpt_root"
  let (old_whitelisted_value, mpt_proof) = whitelist_proof

  let tx_start_time = get_tx_start_time(validity_range)
  let tx_time_gap = minting_start_time - tx_start_time

  // update whitelisted value
  let (new_whitelisted_value, new_ordered_amount) =
    update_whitelisted_value(
      old_whitelisted_value,
      [],
      ordered_amount,
      tx_time_gap,
    )

  // check new ordered amount
  let is_whitelisted_amount_sufficient = new_ordered_amount <= 0
  expect is_whitelisted_amount_sufficient

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
  new_root
}

// this function checks
// whitelisted_value is sufficient to mint `ordered_amount`
// and update the value
//
pub fn update_whitelisted_value(
  whitelisted_value: WhitelistedValue,
  new_whitelisted_value: WhitelistedValue,
  ordered_amount: Int,
  tx_time_gap: Int,
) -> (WhitelistedValue, Int) {
  when whitelisted_value is {
    [] -> (new_whitelisted_value, ordered_amount)
    [whitelisted_item, ..rest_whitelisted_items] -> {
      let WhitelistedItem { time_gap, amount } = whitelisted_item
      // check amount
      if amount <= 0 {
        update_whitelisted_value(
          rest_whitelisted_items,
          new_whitelisted_value,
          ordered_amount,
          tx_time_gap,
        )
      } else {
        // check time_gap
        if tx_time_gap > time_gap {
          update_whitelisted_value(
            rest_whitelisted_items,
            new_whitelisted_value |> list.concat([whitelisted_item]),
            ordered_amount,
            tx_time_gap,
          )
        } else {
          let available_amount = math.min(amount, ordered_amount)
          let new_amount = amount - available_amount
          let new_ordered_amount = ordered_amount - available_amount

          let new_whitelisted_value =
            if new_amount <= 0 {
              new_whitelisted_value
            } else {
              let updated_whitelisted_item =
                WhitelistedItem { time_gap, amount: new_amount }
              new_whitelisted_value
                |> list.concat([updated_whitelisted_item])
            }

          if new_ordered_amount <= 0 {
            (new_whitelisted_value |> list.concat(rest_whitelisted_items), 0)
          } else {
            update_whitelisted_value(
              rest_whitelisted_items,
              new_whitelisted_value,
              new_ordered_amount,
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
// that will be aggregated with sum of amounts
//
pub fn aggregate_orders_information(
  inputs: List<Input>,
  aggregated_orders: List<Order>,
  orders_spend_script_hash: ScriptHash,
  hal_nft_price: Int,
  continuation: fn(List<Order>) -> result,
) -> result {
  when inputs is {
    [] -> continuation(aggregated_orders)
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

          // calculate price
          let paid_price = hal_nft_price * amount

          // check order input's lovelace
          let has_enough_lovelace =
            value.lovelace_of(order_input_value) >= paid_price
          expect has_enough_lovelace

          aggregate_orders_information(
            rest_inputs,
            add_order_to_aggregated_orders(
              aggregated_orders,
              destination_address,
              amount,
            ),
            orders_spend_script_hash,
            hal_nft_price,
            continuation,
          )
        }
        False ->
          aggregate_orders_information(
            rest_inputs,
            aggregated_orders,
            orders_spend_script_hash,
            hal_nft_price,
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
