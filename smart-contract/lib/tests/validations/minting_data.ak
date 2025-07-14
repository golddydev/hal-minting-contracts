use aiken/interval
use aiken/merkle_patricia_forestry as mpt
use aiken/transaction.{OutputReference, TransactionId}
use hal_nft_mint/whitelist.{WhitelistedItem}
use tests/mocks/fake_constants.{
  allowed_minter, hal_nft_price, mint_governor, minting_data_script_hash,
  minting_start_time, two_hours_in_milliseconds, user_1_address,
}
use tests/mocks/fake_tx.{
  make_hal_minted_value, make_minting_data_input, make_minting_data_output,
  make_order_input, make_reference_outputs, make_settings_reference_input,
  make_transaction, make_user_output, make_withdrawals,
}
use tests/mpt/hal_mpt.{
  initial_trie, proof_hal_2, proof_hal_3, proof_hal_5, trie_with_hal_2_3_5,
}
use tests/mpt/hal_whitelist_mpt.{
  whitelist_initial_trie, whitelist_proof_user_1_1,
  whitelist_trie_with_user_1_minted_3,
}
use validations/minting_data/types.{Proofs}
use validations/minting_data/validation.{can_mint}

test can_mint_3_as_one_order() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
      spending_tx_hash,
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
    )

  let asset_names =
    ["hal-2", "hal-3", "hal-5"]

  let order_inputs =
    [make_order_input(user_1_address(), 3, hal_nft_price * 3, #"0001")]
  let user_output = make_user_output(user_1_address(), asset_names)
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let proofs_list: List<Proofs> =
    [
      (
        [
          ("hal-2", proof_hal_2()),
          ("hal-3", proof_hal_3()),
          ("hal-5", proof_hal_5()),
        ],
        None,
      ),
    ]

  let transaction =
    make_transaction(
      [minting_data_input, ..order_inputs],
      [settings_reference_input],
      [minting_data_output, user_output, ..reference_outputs],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.entirely_after(minting_start_time),
    )
  can_mint(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
    proofs_list,
  )
}

test can_mint_3_as_one_order_and_whitelisted() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      whitelist_initial_trie() |> mpt.root,
      minting_data_script_hash,
      spending_tx_hash,
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      whitelist_trie_with_user_1_minted_3() |> mpt.root,
      minting_data_script_hash,
    )

  let asset_names =
    ["hal-2", "hal-3", "hal-5"]

  let order_inputs =
    [make_order_input(user_1_address(), 3, hal_nft_price * 3, #"0001")]
  let user_output = make_user_output(user_1_address(), asset_names)
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let user_1_whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 5)
  let proofs_list: List<Proofs> =
    [
      (
        [
          ("hal-2", proof_hal_2()),
          ("hal-3", proof_hal_3()),
          ("hal-5", proof_hal_5()),
        ],
        Some((user_1_whitelisted_item, whitelist_proof_user_1_1())),
      ),
    ]

  let transaction =
    make_transaction(
      [minting_data_input, ..order_inputs],
      [settings_reference_input],
      [minting_data_output, user_output, ..reference_outputs],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.entirely_after(minting_start_time - two_hours_in_milliseconds),
    )
  can_mint(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
    proofs_list,
  )
}
