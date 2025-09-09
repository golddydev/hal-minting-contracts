use aiken/list
use aiken/transaction.{InlineDatum, Input, Output}
use aiken/transaction/value
use common/hashes.{ScriptHash}

const ref_spend_settings_asset_policy_id =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

// hal_pz@handle_settings
// hold the settings for the Ref Spend Contract
const ref_spend_settings_asset_name =
  #"000de14068616c5f707a4068616e646c655f73657474696e6773"

pub type RefSpendSettings {
  // ref_spend withdrawal validator hash
  // this is ref_spend_proxy governor
  ref_spend_governor: ScriptHash,
  // setting v1 data
  data: Data,
}

pub fn find_ref_spend_settings(
  reference_inputs: List<Input>,
) -> RefSpendSettings {
  expect Some(settings_input) =
    list.find(
      reference_inputs,
      fn(i) {
        value.quantity_of(
          i.output.value,
          ref_spend_settings_asset_policy_id,
          ref_spend_settings_asset_name,
        ) == 1
      },
    )
  expect InlineDatum(settings_datum) = settings_input.output.datum
  expect settings_datum: RefSpendSettings = settings_datum
  settings_datum
}
