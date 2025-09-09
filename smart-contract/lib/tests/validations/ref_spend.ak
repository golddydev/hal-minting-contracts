use aiken/bytearray
use aiken/interval
use aiken/transaction.{Output}
use aiken/transaction/credential
use aiken/transaction/value
use common/cip68.{prefix_100}
use tests/mocks/fake_constants.{
  hal_policy_id, ref_spend_admin, ref_spend_proxy_script_hash, user_1_address,
}
use tests/mocks/fake_tx.{
  make_cip68_datum, make_ref_spend_proxy_input,
  make_ref_spend_proxy_user_input_and_output,
  make_ref_spend_settings_reference_input, make_transaction,
}
use validations/ref_spend/validation.{can_update}

test can_update_0() {
  let settings_reference_input = make_ref_spend_settings_reference_input()
  let spending_tx_hash = #"0000"
  let asset_name = "hal-2"
  let refined_asset_name = "hal-2-refined"
  let ref_asset_name = bytearray.concat(prefix_100, asset_name)

  let ref_input = make_ref_spend_proxy_input(asset_name, spending_tx_hash)
  let (user_input, user_output) =
    make_ref_spend_proxy_user_input_and_output(user_1_address(), asset_name)

  let new_datum = make_cip68_datum(refined_asset_name)
  let ref_output =
    Output {
      address: credential.from_script(ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, ref_asset_name, 1),
      datum: new_datum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [ref_input, user_input],
      [settings_reference_input],
      [ref_output, user_output],
      value.zero(),
      [],
      [ref_spend_admin],
      interval.everything(),
    )
  can_update(transaction, asset_name)
}

test cannot_update_if_not_signed_by_ref_spend_admin() fail {
  let settings_reference_input = make_ref_spend_settings_reference_input()
  let spending_tx_hash = #"0000"
  let asset_name = "hal-2"
  let refined_asset_name = "hal-2-refined"
  let ref_asset_name = bytearray.concat(prefix_100, asset_name)

  let ref_input = make_ref_spend_proxy_input(asset_name, spending_tx_hash)
  let (user_input, user_output) =
    make_ref_spend_proxy_user_input_and_output(user_1_address(), asset_name)

  let new_datum = make_cip68_datum(refined_asset_name)
  let ref_output =
    Output {
      address: credential.from_script(ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, ref_asset_name, 1),
      datum: new_datum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [ref_input, user_input],
      [settings_reference_input],
      [ref_output, user_output],
      value.zero(),
      [],
      [],
      interval.everything(),
    )
  can_update(transaction, asset_name)
}

test cannot_update_if_not_spend_user_asset() fail {
  let settings_reference_input = make_ref_spend_settings_reference_input()
  let spending_tx_hash = #"0000"
  let asset_name = "hal-2"
  let refined_asset_name = "hal-2-refined"
  let ref_asset_name = bytearray.concat(prefix_100, asset_name)

  let ref_input = make_ref_spend_proxy_input(asset_name, spending_tx_hash)

  let new_datum = make_cip68_datum(refined_asset_name)
  let ref_output =
    Output {
      address: credential.from_script(ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, ref_asset_name, 1),
      datum: new_datum,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [ref_input],
      [settings_reference_input],
      [ref_output],
      value.zero(),
      [],
      [ref_spend_admin],
      interval.everything(),
    )
  can_update(transaction, asset_name)
}

test cannot_update_two_reference_assets() fail {
  let settings_reference_input = make_ref_spend_settings_reference_input()
  let spending_tx_hash = #"0000"
  let asset_name_1 = "hal-2"
  let asset_name_2 = "hal-3"
  let refined_asset_name_1 = "hal-2-refined"
  let refined_asset_name_2 = "hal-3-refined"
  let ref_asset_name_1 = bytearray.concat(prefix_100, asset_name_1)
  let ref_asset_name_2 = bytearray.concat(prefix_100, asset_name_2)

  let ref_input_1 = make_ref_spend_proxy_input(asset_name_1, spending_tx_hash)
  let ref_input_2 = make_ref_spend_proxy_input(asset_name_2, spending_tx_hash)
  let (user_input_1, user_output_1) =
    make_ref_spend_proxy_user_input_and_output(user_1_address(), asset_name_1)
  let (user_input_2, user_output_2) =
    make_ref_spend_proxy_user_input_and_output(user_1_address(), asset_name_2)

  let new_datum_1 = make_cip68_datum(refined_asset_name_1)
  let new_datum_2 = make_cip68_datum(refined_asset_name_2)
  let ref_output_1 =
    Output {
      address: credential.from_script(ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, ref_asset_name_1, 1),
      datum: new_datum_1,
      reference_script: None,
    }
  let ref_output_2 =
    Output {
      address: credential.from_script(ref_spend_proxy_script_hash),
      value: value.zero()
        |> value.add(hal_policy_id, ref_asset_name_2, 1),
      datum: new_datum_2,
      reference_script: None,
    }

  let transaction =
    make_transaction(
      [ref_input_1, ref_input_2, user_input_1, user_input_2],
      [settings_reference_input],
      [ref_output_1, ref_output_2, user_output_1, user_output_2],
      value.zero(),
      [],
      [ref_spend_admin],
      interval.everything(),
    )
  can_update(transaction, asset_name_1)
}
