use aiken/interval
use aiken/merkle_patricia_forestry as mpt
use aiken/transaction.{InlineDatum, Output, Transaction}
use aiken/transaction/credential
use aiken/transaction/value
use common/royalty.{royalty_asset_full_name}
use tests/mocks/fake_constants.{
  allowed_minter, hal_policy_id, mint_governor, minting_data_script_hash,
  royalty_spend_script_hash,
}
use tests/mocks/fake_tx.{
  make_minting_data_input, make_minting_data_output, make_royalty_datum,
  make_settings_reference_input, make_transaction, make_withdrawals,
}
use tests/mpt/hal_mpt.{initial_trie, trie_with_hal_2_3_5}
use validations/mint/validation.{can_mint_nfts, can_mint_royalty_nft}

test can_mint_nfts_0() {
  let settings_reference_input = make_settings_reference_input()

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
      #"0000",
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
    )

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [minting_data_input],
      [settings_reference_input],
      [minting_data_output],
      value.zero(),
      make_withdrawals(mint_governor),
      [],
      interval.everything(),
    )

  can_mint_nfts(transaction)
}

test cannot_mint_nfts_without_settings_reference_input() fail {
  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
      #"0000",
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
    )

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [minting_data_input],
      [],
      [minting_data_output],
      value.zero(),
      make_withdrawals(mint_governor),
      [],
      interval.everything(),
    )

  can_mint_nfts(transaction)
}

test cannot_mint_nfts_without_spending_minting_data_input() fail {
  let settings_reference_input = make_settings_reference_input()

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [],
      value.zero(),
      make_withdrawals(mint_governor),
      [],
      interval.everything(),
    )

  can_mint_nfts(transaction)
}

test cannot_mint_nfts_without_spending_from_correct_script() fail {
  let settings_reference_input = make_settings_reference_input()
  let invalid_minting_data_script_hash = #"0000"

  let minting_data_input =
    make_minting_data_input(
      initial_trie() |> mpt.root,
      mpt.empty() |> mpt.root,
      invalid_minting_data_script_hash,
      #"0000",
    )
  let minting_data_output =
    make_minting_data_output(
      trie_with_hal_2_3_5() |> mpt.root,
      mpt.empty() |> mpt.root,
      minting_data_script_hash,
    )

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [minting_data_input],
      [settings_reference_input],
      [minting_data_output],
      value.zero(),
      make_withdrawals(mint_governor),
      [],
      interval.everything(),
    )

  can_mint_nfts(transaction)
}

test can_mint_royalty_nft_0() {
  let settings_reference_input = make_settings_reference_input()

  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_without_settings_reference_input() fail {
  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_not_signed_by_allowed_minter() fail {
  let settings_reference_input = make_settings_reference_input()

  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_mint_more_than_one_royalty_assets() fail {
  let settings_reference_input = make_settings_reference_input()

  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 2)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_mint_with_wrong_asset_name() fail {
  let settings_reference_input = make_settings_reference_input()

  let wrong_royalty_asset_name = "wrong_royalty"
  let minted_value =
    value.zero() |> value.add(hal_policy_id, wrong_royalty_asset_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_royalty_output_has_wrong_address() fail {
  let settings_reference_input = make_settings_reference_input()

  let wrong_royalty_spend_script_hash = #"0000"
  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(wrong_royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_royalty_output_datum_is_invalid() fail {
  let settings_reference_input = make_settings_reference_input()

  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = InlineDatum(["wrong_datum"])
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: None,
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}

test cannot_mint_royalty_nft_if_reference_script_is_not_none() fail {
  let settings_reference_input = make_settings_reference_input()

  let minted_value =
    value.zero() |> value.add(hal_policy_id, royalty_asset_full_name, 1)
  let royalty_datum = make_royalty_datum()
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: minted_value,
      datum: royalty_datum,
      reference_script: Some(#"0000"),
    }

  // Skip all orders inputs and minted value
  let transaction: Transaction =
    make_transaction(
      [],
      [settings_reference_input],
      [royalty_output],
      minted_value,
      make_withdrawals(mint_governor),
      [allowed_minter],
      interval.everything(),
    )

  can_mint_royalty_nft(transaction)
}
