use aiken/transaction.{ScriptContext, WithdrawFrom}
use aiken/transaction/value.{AssetName}
use validations/ref_spend/validation.{can_update}

// NOTE:
// This is Withdrawal validator which holds all `ref_spend` logic
// This is referred to as `ref_spend_governor` in SettingsV1 datum
//
validator {
  fn spend(_redeemer: Data, ctx: ScriptContext) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect WithdrawFrom(_) = purpose

    can_update(transaction)
  }
}
