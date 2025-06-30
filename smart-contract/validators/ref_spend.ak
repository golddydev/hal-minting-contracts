use aiken/transaction.{ScriptContext, WithdrawFrom}
use aiken/transaction/value.{AssetName}
use common/hashes.{VerificationKeyHash}
use validations/ref_spend/validation.{can_update}

type RefSpendRedeemer {
  Update(AssetName)
  Migrate
}

// NOTE:
// This is Withdrawal validator which holds all `ref_spend` logic
// This is referred to as `ref_spend_governor` in SettingsV1 datum
//
validator(ref_spend_admin: VerificationKeyHash) {
  fn withdraw(redeemer: RefSpendRedeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect WithdrawFrom(_) = purpose

    when redeemer is {
      Update(asset_name) -> can_update(transaction, ref_spend_admin, asset_name)
      Migrate -> {
        trace @"Migrate is disabled now"
        False
      }
    }
  }
}
