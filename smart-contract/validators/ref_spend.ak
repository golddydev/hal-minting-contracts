use aiken/transaction.{ScriptContext, WithdrawFrom}
use aiken/transaction/value.{AssetName}
use common/hashes.{VerificationKeyHash}
use validations/ref_spend/validation.{can_update}

// NOTE:
// This is Withdrawal validator which holds all `ref_spend` logic
// This is referred to as `ref_spend_governor` in SettingsV1 datum
//
validator(ref_spend_admin: VerificationKeyHash) {
  fn spend(asset_name: AssetName, ctx: ScriptContext) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect WithdrawFrom(_) = purpose

    can_update(transaction, ref_spend_admin, asset_name)
  }
}
