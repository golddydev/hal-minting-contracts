use aiken/interval
use aiken/transaction.{
  InlineDatum, Input, Output, OutputReference, TransactionId,
}
use aiken/transaction/credential
use aiken/transaction/value
use common/royalty.{RoyaltyDatum, RoyaltyRecipient, royalty_asset_full_name}
use tests/mocks/fake_constants.{
  allowed_minter, hal_policy_id, royalty_spend_script_hash, user_1_address,
}
use tests/mocks/fake_tx.{
  make_royalty_datum, make_royalty_spend_proxy_input,
  make_settings_reference_input, make_transaction,
}
use validations/royalty_spend/validation.{can_migrate, can_update}

test can_update_0() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_update(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_update_if_not_signed_by_allowed_minter() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_update(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_update_if_not_spend_royalty_asset() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input =
    Input {
      output_reference: OutputReference {
        transaction_id: TransactionId { hash: spending_tx_hash },
        output_index: 0,
      },
      output: Output {
        address: credential.from_script(royalty_spend_script_hash),
        value: value.zero(),
        datum: make_royalty_datum(),
        reference_script: None,
      },
    }
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_update(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_update_if_spend_two_royalty_assets() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_inputs =
    [
      make_royalty_spend_proxy_input(spending_tx_hash),
      make_royalty_spend_proxy_input(#"0001"),
    ]
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      royalty_inputs,
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_update(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test can_migrate_0() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_migrate(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_migrate_with_different_value() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero(),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_migrate(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_migrate_to_different_script_hash() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let wrong_royalty_spend_script_hash = #"0000"
  let royalty_output =
    Output {
      address: credential.from_script(wrong_royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_migrate(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_migrate_with_different_datum() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_input = make_royalty_spend_proxy_input(spending_tx_hash)
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: InlineDatum(
        RoyaltyDatum {
          recipients: [
            RoyaltyRecipient {
              address: user_1_address(),
              fee: 1000,
              min_fee: None,
              max_fee: None,
            },
          ],
          version: 1,
          extra: Void,
        },
      ),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [royalty_input],
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_migrate(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_migrate_two_royalty_assets() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let royalty_inputs =
    [
      make_royalty_spend_proxy_input(spending_tx_hash),
      make_royalty_spend_proxy_input(#"0001"),
    ]
  let royalty_output =
    Output {
      address: credential.from_script(royalty_spend_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, royalty_asset_full_name, 1),
      datum: make_royalty_datum(),
      reference_script: None,
    }

  let transaction =
    make_transaction(
      royalty_inputs,
      [settings_reference_input],
      [royalty_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_migrate(
    transaction,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}
