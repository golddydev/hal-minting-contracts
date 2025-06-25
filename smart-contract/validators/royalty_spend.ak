use aiken/transaction.{ScriptContext, Spend}
use validations/royalty_spend/validation.{can_migrate, can_update}

type RoyaltySpendRedeemer {
  Update
  Migrate
}

// This is Spending validator
// Where H.A.L. Royalty NFT is locked with Royalty datum
//
validator {
  fn spend(
    _datum: Data,
    redeemer: RoyaltySpendRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect Spend(spending_output_reference) = purpose

    when redeemer is {
      Update -> can_update(transaction, spending_output_reference)
      Migrate -> can_migrate(transaction, spending_output_reference)
    }
  }
}
