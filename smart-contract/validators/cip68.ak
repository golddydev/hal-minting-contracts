use aiken/transaction.{ScriptContext, Spend}
use aiken/transaction/value.{AssetName}
use validations/cip68/validation.{can_migrate, can_update}

type CIP68Redeemer {
  Update(AssetName)
  Migrate
}

// This is Spending validator
// Where H.A.L. reference asset is saved with datum
//
validator {
  fn spend(_d: Data, redeemer: CIP68Redeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect Spend(spending_output_reference) = purpose

    when redeemer is {
      Update(asset_name) ->
        can_update(transaction, spending_output_reference, asset_name)
      Migrate -> can_migrate(transaction, spending_output_reference)
    }
  }
}
