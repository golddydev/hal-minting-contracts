use aiken/list
use aiken/merkle_patricia_forestry as mpt
use aiken/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction, find_input,
}
use aiken/transaction/value
use common/hashes.{VerificationKeyHash}
use hal_nft_mint/minting_data.{MintingData, resolve_minting_data}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/minting_data/types.{Proofs}
use validations/minting_data/utils.{
  aggregate_orders_information, are_all_orders_fulfilled,
  check_hal_tokens_minted, check_ref_outputs,
}

// Validation:
// All H.A.L. Minting logic is here
//
// Checks
// - must attach Setting in reference inputs
// - signed by allowed_minter
// - first output must be minting_data output 
//   with updated root hash and whitelist root hash
// - all orders (Order UTxOs) are fulfilled correctly
//   we aggregate orders for same destination address
//   for each aggregated order
//   must have corresponding user output (with aggregated amount of H.A.L. NFTs)
// - must have reference outputs for each H.A.L. NFTs
// - must mint amount of H.A.L. NFTs
//
pub fn can_mint(
  transaction: Transaction,
  spending_output_reference: OutputReference,
  proofs_list: List<Proofs>,
) -> Bool {
  trace @"can_mint"
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    mint,
    validity_range,
    extra_signatories,
    ..
  } = transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 {
    policy_id,
    allowed_minter,
    ref_spend_script_address,
    orders_spend_script_address,
    minting_start_time,
    ..
  } = settings_datum

  // signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // find minting data input which is own input
  expect Some(spending_input) = find_input(inputs, spending_output_reference)
  let Input { output: minting_data_input, .. } = spending_input
  let MintingData { mpt_root_hash, whitelist_mpt_root_hash } =
    resolve_minting_data(minting_data_input)

  // build merkle patricia trie from old root hash
  let root = mpt.from_root(mpt_root_hash)
  let whitelist_root = mpt.from_root(whitelist_mpt_root_hash)

  // aggregate orders
  let aggregated_orders <-
    aggregate_orders_information(inputs, [], orders_spend_script_address)
  let aggregated_orders_count = list.length(aggregated_orders)

  // parse outputs
  expect [minting_data_output, ..rest_outputs] = outputs
  let user_outputs = list.take(rest_outputs, aggregated_orders_count)
  let rest_outputs = list.drop(rest_outputs, aggregated_orders_count)

  // all orders are satisfied correctly
  // mpt root and whitelist mpt root are updated correctly
  // and user output is valid
  let
    new_root,
    new_whitelist_root,
    hal_asset_names,
  <-
    are_all_orders_fulfilled(
      aggregated_orders,
      user_outputs,
      root,
      whitelist_root,
      [],
      policy_id,
      validity_range,
      minting_start_time,
      proofs_list,
    )

  // check reference outputs
  let are_ref_outputs_valid =
    check_ref_outputs(
      hal_asset_names,
      rest_outputs,
      ref_spend_script_address,
      policy_id,
    )
  expect are_ref_outputs_valid

  // calculate new roots
  let new_mpt_root_hash = new_root |> mpt.root
  let new_whitelist_mpt_root_hash = new_whitelist_root |> mpt.root

  // first output must be minting_data output with updated root hash
  // and whitelist root hash
  expect minting_data_output.address == minting_data_input.address
  expect
    minting_data_output.datum == InlineDatum(
      MintingData {
        mpt_root_hash: new_mpt_root_hash,
        whitelist_mpt_root_hash: new_whitelist_mpt_root_hash,
      },
    )
  expect minting_data_output.reference_script == None

  // must mint H.A.L. NFTs correctly for hal asset names
  let are_hal_tokens_minted_correctly =
    check_hal_tokens_minted(
      hal_asset_names,
      mint |> value.from_minted_value,
      policy_id,
    )
  expect are_hal_tokens_minted_correctly

  True
}

// Validation:
// When admin tries to update MPT root hash
//
// Checks:
// - must not mint anything
// - must be signed by admin
//
pub fn can_update_mpt(
  transaction: Transaction,
  admin_verification_key_hash: VerificationKeyHash,
) -> Bool {
  let Transaction { extra_signatories, mint, .. } = transaction

  // must not mint anything
  expect value.from_minted_value(mint) == value.zero()

  // must be signed by admin
  expect list.has(extra_signatories, admin_verification_key_hash)

  True
}
