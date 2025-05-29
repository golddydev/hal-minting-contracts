use aiken/transaction.{Mint, ScriptContext}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId}
use validations/orders_mint/validation.{
  can_cancel_order, can_execute_orders, can_mint_order,
}

type OrderMintRedeemer {
  MintOrder(Address, Int)
  ExecuteOrders
  CancelOrder
}

// This is Minting Policy for Order NFTs
// Order NFTs are used to check UTxO in Orders Spend validator
// are valid
//
// ===== Parameters =====
// `hal_policy_id`: Policy id of HAL NFT
//
validator(hal_policy_id: PolicyId) {
  fn mint(redeemer: OrderMintRedeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    expect Mint(policy_id) = purpose

    when redeemer is {
      MintOrder(destination_address, amount) ->
        can_mint_order(destination_address, amount, policy_id, transaction)
      ExecuteOrders -> can_execute_orders(transaction, hal_policy_id)
      CancelOrder -> can_cancel_order(policy_id, transaction)
    }
  }
}
