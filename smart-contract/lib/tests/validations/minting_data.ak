use aiken/bytearray
use aiken/interval
use aiken/merkle_patricia_forestry as mpt
use aiken/transaction.{Output, OutputReference, TransactionId}
use aiken/transaction/credential
use aiken/transaction/value
use common/cip68.{prefix_100}
use hal_nft_mint/whitelist.{WhitelistedItem}
use tests/mocks/fake_constants.{
  admin_verification_key_hash, allowed_minter, hal_nft_price, hal_policy_id,
  mint_governor, minting_data_script_hash, minting_start_time,
  one_hour_in_milliseconds, two_hours_in_milliseconds, user_1_address,
  user_2_address,
}
use tests/mocks/fake_tx.{
  make_cip68_datum, make_hal_minted_value, make_minting_data_input,
  make_minting_data_output, make_order_input, make_reference_outputs,
  make_settings_reference_input, make_transaction, make_user_output,
  make_withdrawals,
}
use tests/mpt/hal_mpt.{
  initial_trie, proof_hal_2, proof_hal_3, proof_hal_5, trie_with_hal_2_3_5,
}
use tests/mpt/hal_whitelist_mpt.{
  whitelist_initial_trie, whitelist_proof_user_1_1, whitelist_proof_user_2_1,
  whitelist_trie_with_user_1_minted_3,
  whitelist_trie_with_user_1_minted_3_user_2_minted_3,
  whitelist_trie_with_user_1_minted_5_user_2_minted_3,
}
use validations/minting_data/types.{Proofs}
use validations/minting_data/validation.{can_mint, can_update_mpt}

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

test can_mint_3_as_two_orders() {
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
    [
      make_order_input(user_1_address(), 2, hal_nft_price * 2, #"0001"),
      make_order_input(user_1_address(), 1, hal_nft_price * 1, #"0002"),
    ]
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

test can_mint_3_as_two_orders_for_two_users() {
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
    [
      make_order_input(user_1_address(), 2, hal_nft_price * 2, #"0001"),
      make_order_input(user_2_address(), 1, hal_nft_price * 1, #"0002"),
    ]
  let user_1_output = make_user_output(user_1_address(), ["hal-2", "hal-3"])
  let user_2_output = make_user_output(user_2_address(), ["hal-5"])
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let proofs_list: List<Proofs> =
    [
      ([("hal-2", proof_hal_2()), ("hal-3", proof_hal_3())], None),
      ([("hal-5", proof_hal_5())], None),
    ]

  let transaction =
    make_transaction(
      [minting_data_input, ..order_inputs],
      [settings_reference_input],
      [minting_data_output, user_1_output, user_2_output, ..reference_outputs],
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

test can_mint_3_as_two_orders_and_whitelisted() {
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
    [
      make_order_input(user_1_address(), 2, hal_nft_price * 2, #"0001"),
      make_order_input(user_1_address(), 1, hal_nft_price * 1, #"0002"),
    ]
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

test cannot_mint_if_not_signed_by_allowed_minter() fail {
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
      [],
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

test cannot_mint_without_spending_minting_data_input() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

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
      order_inputs,
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

test cannot_mint_with_invalid_user_output() fail {
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
  let user_output = make_user_output(user_1_address(), ["hal-2", "hal-3"])
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

test cannot_mint_with_reference_asset_sent_to_wrong_address() fail {
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
  let wrong_ref_spend_proxy_script_hash = #"0001"
  let wrong_reference_output =
    Output {
      address: credential.from_script(wrong_ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, bytearray.concat(prefix_100, "hal-2"), 1),
      datum: make_cip68_datum("hal-3"),
      reference_script: None,
    }
  let reference_outputs = make_reference_outputs(["hal-3", "hal-5"])
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
      [
        minting_data_output,
        user_output,
        wrong_reference_output,
        ..reference_outputs
      ],
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

test cannot_mint_if_order_inputs_user_outputs_not_in_same_order() fail {
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
    [
      make_order_input(user_1_address(), 2, hal_nft_price * 2, #"0001"),
      make_order_input(user_2_address(), 1, hal_nft_price * 1, #"0002"),
    ]
  let user_1_output = make_user_output(user_1_address(), ["hal-2", "hal-3"])
  let user_2_output = make_user_output(user_2_address(), ["hal-5"])
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let proofs_list: List<Proofs> =
    [
      ([("hal-2", proof_hal_2()), ("hal-3", proof_hal_3())], None),
      ([("hal-5", proof_hal_5())], None),
    ]

  let transaction =
    make_transaction(
      [minting_data_input, ..order_inputs],
      [settings_reference_input],
      [minting_data_output, user_2_output, user_1_output, ..reference_outputs],
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

test cannot_mint_as_whitelisted_if_not_whitelisted() fail {
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

test cannot_mint_before_whitelisted_item() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      whitelist_trie_with_user_1_minted_3() |> mpt.root,
      minting_data_script_hash,
      spending_tx_hash,
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      whitelist_trie_with_user_1_minted_3_user_2_minted_3() |> mpt.root,
      minting_data_script_hash,
    )

  let asset_names =
    ["hal-2", "hal-3", "hal-5"]

  let order_inputs =
    [make_order_input(user_2_address(), 3, hal_nft_price * 3, #"0001")]
  let user_output = make_user_output(user_2_address(), asset_names)
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let user_2_whitelisted_item: WhitelistedItem = (one_hour_in_milliseconds, 10)
  let proofs_list: List<Proofs> =
    [
      (
        [
          ("hal-2", proof_hal_2()),
          ("hal-3", proof_hal_3()),
          ("hal-5", proof_hal_5()),
        ],
        Some((user_2_whitelisted_item, whitelist_proof_user_2_1())),
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

test cannot_mint_more_than_whitelisted_amount() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      whitelist_trie_with_user_1_minted_3_user_2_minted_3() |> mpt.root,
      minting_data_script_hash,
      spending_tx_hash,
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      whitelist_trie_with_user_1_minted_5_user_2_minted_3() |> mpt.root,
      minting_data_script_hash,
    )

  let asset_names =
    ["hal-2", "hal-3", "hal-5"]

  let order_inputs =
    [make_order_input(user_1_address(), 3, hal_nft_price * 3, #"0001")]
  let user_output = make_user_output(user_1_address(), asset_names)
  let reference_outputs = make_reference_outputs(asset_names)
  let minted_value = make_hal_minted_value(asset_names)

  let user_1_whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 2)
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

test can_update_mpt_0() {
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

  let transaction =
    make_transaction(
      [minting_data_input],
      [settings_reference_input],
      [minting_data_output],
      value.zero(),
      [],
      [admin_verification_key_hash],
      interval.everything(),
    )
  can_update_mpt(transaction, admin_verification_key_hash)
}

test cannot_update_mpt_if_not_signed_by_admin() fail {
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

  let transaction =
    make_transaction(
      [minting_data_input],
      [settings_reference_input],
      [minting_data_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_update_mpt(transaction, admin_verification_key_hash)
}

test cannot_update_with_minting_assets() fail {
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

  let minted_value = make_hal_minted_value(["hal-2", "hal-3", "hal-5"])

  let transaction =
    make_transaction(
      [minting_data_input],
      [settings_reference_input],
      [minting_data_output],
      minted_value,
      [],
      [admin_verification_key_hash],
      interval.everything(),
    )
  can_update_mpt(transaction, admin_verification_key_hash)
}
