use aiken/interval
use aiken/transaction.{
  InlineDatum, NoDatum, Output, OutputReference, TransactionId,
}
use aiken/transaction/credential.{Address, VerificationKeyCredential}
use aiken/transaction/value
use hal_nft_mint/orders.{OrderDatum}
use tests/mocks/fake_constants.{
  allowed_minter, hal_nft_price, user_1_address, user_2_address,
}
use tests/mocks/fake_tx.{
  make_order_datum, make_order_input, make_settings_reference_input,
  make_transaction,
}
use validations/orders_spend/validation.{can_cancel_order, can_refund_order}

test can_cancel_order_0() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }
  expect Address {
    payment_credential: VerificationKeyCredential(owner_key_hash),
    ..
  } = user_1_address()

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [owner_key_hash],
      interval.everything(),
    )
  can_cancel_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_cancel_order_if_not_signed_by_owner() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_cancel_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_cancel_two_orders() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_inputs =
    [
      make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash),
      make_order_input(user_1_address(), 3, hal_nft_price * 3, #"0001"),
    ]
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_outputs =
    [
      Output {
        address: user_1_address(),
        value: value.from_lovelace(hal_nft_price * 3),
        datum: NoDatum,
        reference_script: None,
      },
      Output {
        address: user_1_address(),
        value: value.from_lovelace(hal_nft_price * 3),
        datum: NoDatum,
        reference_script: None,
      },
    ]
  expect Address {
    payment_credential: VerificationKeyCredential(owner_key_hash),
    ..
  } = user_1_address()

  let transaction =
    make_transaction(
      order_inputs,
      [settings_reference_input],
      user_outputs,
      value.zero(),
      [],
      [owner_key_hash],
      interval.everything(),
    )
  can_cancel_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_cancel_order_if_datum_is_invalid() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum = InlineDatum(["wrong_datum"])
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }
  expect Address {
    payment_credential: VerificationKeyCredential(owner_key_hash),
    ..
  } = user_1_address()

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [owner_key_hash],
      interval.everything(),
    )
  can_cancel_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test can_refund_order_with_valid_datum() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test can_refund_order_with_invalid_datum() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum = InlineDatum(["wrong_datum"])
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test can_refund_order_with_invalid_datum_to_any_user() {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum = InlineDatum(["wrong_datum"])
  let user_output =
    Output {
      address: user_2_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test can_refund_order_if_not_signed_by_allowed_minter() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_output =
    Output {
      address: user_1_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_refund_order_to_other_user() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_input =
    make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash)
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_output =
    Output {
      address: user_2_address(),
      value: value.from_lovelace(hal_nft_price * 3),
      datum: NoDatum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [order_input],
      [settings_reference_input],
      [user_output],
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}

test cannot_refund_two_orders() fail {
  let settings_reference_input = make_settings_reference_input()
  let spending_tx_hash = #"0000"

  let order_inputs =
    [
      make_order_input(user_1_address(), 3, hal_nft_price * 3, spending_tx_hash),
      make_order_input(user_1_address(), 3, hal_nft_price * 3, #"0001"),
    ]
  let datum: OrderDatum = make_order_datum(user_1_address(), 3)
  let user_outputs =
    [
      Output {
        address: user_1_address(),
        value: value.from_lovelace(hal_nft_price * 3),
        datum: NoDatum,
        reference_script: None,
      },
      Output {
        address: user_1_address(),
        value: value.from_lovelace(hal_nft_price * 3),
        datum: NoDatum,
        reference_script: None,
      },
    ]

  let transaction =
    make_transaction(
      order_inputs,
      [settings_reference_input],
      user_outputs,
      value.zero(),
      [],
      [allowed_minter],
      interval.everything(),
    )
  can_refund_order(
    transaction,
    datum,
    OutputReference {
      transaction_id: TransactionId { hash: spending_tx_hash },
      output_index: 0,
    },
  )
}
