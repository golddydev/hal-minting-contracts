use aiken/transaction.{ScriptContext, Spend, Transaction}
use common/utils.{is_withdrawal_script_executed}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}

// NOTE:
// This is spending validator where H.A.L. Reference Assets are locked
// with their datums. (CIP68Datum)
//
// This spending validator's hash won't change without strong reason.
//
validator {
  pub fn spend(_datum: Data, _redeemer: Data, ctx: ScriptContext) {
    let ScriptContext { transaction, purpose } = ctx
    expect Spend(_) = purpose

    let Transaction { withdrawals, reference_inputs, .. } = transaction

    // must attach `Settings` NFT in reference inputs.
    let Settings { data: settings_data, .. } = find_settings(reference_inputs)
    expect settings_datum: SettingsV1 = settings_data
    let SettingsV1 { ref_spend_governor, .. } = settings_datum

    // check ref_spend_governor is executed
    expect is_withdrawal_script_executed(withdrawals, ref_spend_governor)

    True
  }
}
