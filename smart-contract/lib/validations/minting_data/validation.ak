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
use validations/minting_data/types.{Proof}
use validations/minting_data/utils.{all_orders_are_satisfied}

// Validation:
// All H.A.L. Minting logic is here
//
// Checks
// - must attach Setting in reference inputs
// - signed by allowed_minter
// - all orders are satisfied correctly
//   and minted values are sent to correct addresses
//   and order NFTs are burnt correctly
//   with proofs from redeemer (NOTE: must be in same order as orders UTxOs)
// - first output must be minting_data output with updated root hash
//   with same value as spending UTxO
// - second output must be payment output with total H.A.L. NFTs price
// - must mint only H.A.L. NFTs and burn Order NFTs
//
pub fn can_mint(
  transaction: Transaction,
  spending_output_reference: OutputReference,
  proofs: List<Proof>,
) -> Bool {
  trace @"can_mint"
  let Transaction {
    inputs,
    reference_inputs,
    outputs,
    extra_signatories,
    mint,
    ..
  } = transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 {
    policy_id,
    allowed_minter,
    payment_address,
    cip68_script_address,
    orders_spend_script_address,
    orders_mint_policy_id,
    ..
  } = settings_datum

  // signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // find minting data input which is own input
  expect Some(spending_input) = find_input(inputs, spending_output_reference)
  let Input { output: minting_data_input, .. } = spending_input
  let MintingData { mpt_root_hash } = resolve_minting_data(minting_data_input)

  // parse outputs
  expect [minting_data_output, payment_output, ..rest_outputs] = outputs

  // build merkle patricia trie from old root hash
  let root = mpt.from_root(mpt_root_hash)

  // all orders are satisfied correctly
  // and minted values are sent to correct addresses
  // and order NFTs are burnt correctly
  // with proofs from redeemer
  let
    new_root,
    expected_mint_value,
    total_price,
  <-
    all_orders_are_satisfied(
      orders_spend_script_address,
      orders_mint_policy_id,
      inputs,
      rest_outputs,
      policy_id,
      cip68_script_address,
      proofs,
      root,
      value.zero(),
      0,
    )

  // calculate new root and expected mint value
  let new_mpt_root_hash = new_root |> mpt.root

  // first output must be minting_data output with updated root hash
  // with same value as spending UTxO
  expect minting_data_output.address == minting_data_input.address
  expect
    value.without_lovelace(minting_data_output.value) == value.without_lovelace(
      minting_data_input.value,
    )
  expect
    minting_data_output.datum == InlineDatum(
      MintingData { mpt_root_hash: new_mpt_root_hash },
    )
  expect minting_data_output.reference_script == None

  // second output must be payment output with total H.A.L. NFTs price
  let Output {
    address: payment_output_address,
    value: payment_output_value,
    ..
  } = payment_output
  expect payment_output_address == payment_address
  expect value.lovelace_of(payment_output_value) >= total_price

  // must mint only H.A.L. NFTs and burn Order NFTs
  expect value.from_minted_value(mint) == expected_mint_value

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
