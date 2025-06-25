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
// - must attach `Settings` NFT in reference inputs.
// - must be signed by `allowed_minter` from `Settings`.
// - spending_input must UTxO with `Minting Data NFT`.
// - for Order Tx Inputs (UTxOs from `Settings.orders_spend_script_address`), aggregate orders by destination address. (amount will be summed for the same destination addresses)
// - for each item from `AggregatedOrders`; `destination_address` and `amount`
//   there must be corresponding user output. (with aggregated amount of H.A.L. NFTs)
//   must have corresponding `asset_name_proofs` (`List<AssetNameProof>`) to update `MPF` `root_hash`.
//   if `whitelist_proof_opt` is `None`, transaction must start after `minting_start_time` from `Settings`.
//   if not, we update `Whitelist MPF` `root_hash` with given proof. 
// - first output must be `minting_data_output`; Output with `Minting Data NFT`.
// - must have reference outputs for all `hal_asset_names` (minted in this transaction)
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
    hal_nft_price,
    ref_spend_script_address,
    orders_spend_script_address,
    minting_start_time,
    ..
  } = settings_datum

  // signed by allowed_minter
  expect list.has(extra_signatories, allowed_minter)

  // spending_input must UTxO with `Minting Data NFT`.
  expect Some(spending_input) = find_input(inputs, spending_output_reference)
  let Input { output: minting_data_input, .. } = spending_input
  let MintingData { mpt_root_hash, whitelist_mpt_root_hash } =
    resolve_minting_data(minting_data_input)

  // build merkle patricia trie from old root hash
  let root = mpt.from_root(mpt_root_hash)
  let whitelist_root = mpt.from_root(whitelist_mpt_root_hash)

  // aggregate orders
  let aggregated_orders <-
    aggregate_orders_information(
      inputs,
      [],
      orders_spend_script_address,
      hal_nft_price,
    )
  let aggregated_orders_count = list.length(aggregated_orders)

  // parse outputs
  expect [minting_data_output, ..rest_outputs] = outputs
  let user_outputs = list.take(rest_outputs, aggregated_orders_count)
  let rest_outputs = list.drop(rest_outputs, aggregated_orders_count)

  // for each item from `AggregatedOrders`; `destination_address` and `amount`
  // we update `MPF` `root_hash` and `Whitelist MPF` `root_hash` correctly
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

  // calculate new roots
  let new_mpt_root_hash = new_root |> mpt.root
  let new_whitelist_mpt_root_hash = new_whitelist_root |> mpt.root

  // first output must be `minting_data_output`; Output with `Minting Data NFT`.
  expect minting_data_output.address == minting_data_input.address
  expect
    minting_data_output.datum == InlineDatum(
      MintingData {
        mpt_root_hash: new_mpt_root_hash,
        whitelist_mpt_root_hash: new_whitelist_mpt_root_hash,
      },
    )
  expect minting_data_output.reference_script == None

  // must have reference outputs for all `hal_asset_names` (minted in this transaction)
  let hal_assets_count = list.length(hal_asset_names)
  let rest_outputs = list.take(rest_outputs, hal_assets_count)
  let are_ref_outputs_valid =
    check_ref_outputs(
      hal_asset_names,
      rest_outputs,
      ref_spend_script_address,
      policy_id,
    )
  expect are_ref_outputs_valid

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
// When admin updates `MPF` `root_hash` or `Whitelist MPF` `root_hash`.
//
// Checks:
// - transaction must be signed by `admin_verification_key_hash` from Parameter
// - must not mint any assets
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
