use aiken/transaction.{ScriptContext, Spend}
use aiken/transaction/value.{AssetName}
use validations/ref_spend/validation.{can_migrate, can_update}

type RefSpendRedeemer {
  Update(AssetName)
  Migrate
}

// This is Spending validator
// Where H.A.L. reference assets are locked with datum
//
validator {
  fn spend(_d: Data, redeemer: RefSpendRedeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect Spend(spending_output_reference) = purpose

    when redeemer is {
      Update(asset_name) ->
        can_update(transaction, spending_output_reference, asset_name)
      Migrate -> can_migrate(transaction, spending_output_reference)
    }
  }
}
