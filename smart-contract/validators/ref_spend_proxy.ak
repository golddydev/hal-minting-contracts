use aiken/transaction.{ScriptContext, Spend, Transaction}
use common/utils.{is_withdrawal_script_executed}
use hal_nft_mint/settings.{Settings, find_settings}

// NOTE:
// This is spending validator where H.A.L. Reference Assets are locked
// with their datums. (CIP68Datum)
//
// This spending validator's hash won't change without strong reason.
//
// ========================= When spending validator hash can change? =========================
// - hal_nft_mint/settings library is changed
//
validator {
  pub fn spend(_datum: Data, _redeemer: Data, ctx: ScriptContext) {
    let ScriptContext { transaction, purpose } = ctx
    expect Spend(_) = purpose

    let Transaction { withdrawals, reference_inputs, .. } = transaction

    // must attach `Settings` NFT in reference inputs.
    let Settings { ref_spend_governor, .. } = find_settings(reference_inputs)

    // check ref_spend_governor is executed
    expect is_withdrawal_script_executed(withdrawals, ref_spend_governor)

    True
  }
}
