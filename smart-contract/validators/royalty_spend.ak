use aiken/transaction.{ScriptContext}

// This is Spending validator
// Where Royalty NFT is sent
// with RoyaltyDatum
//
validator {
  fn spend(_datum: Data, _redeemer: Data, _ctx: ScriptContext) -> Bool {
    True
  }
}
