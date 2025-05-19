use aiken/transaction.{Mint, ScriptContext}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId}
use validations/orders_mint/validation.{
  can_cancel_order, can_execute_orders, can_mint_orders,
}

type OrderMintRedeemer {
  MintOrders(List<Address>)
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
      MintOrders(destination_addresses) ->
        can_mint_orders(destination_addresses, policy_id, transaction)
      ExecuteOrders -> can_execute_orders(transaction, hal_policy_id)
      CancelOrder -> can_cancel_order(policy_id, transaction)
    }
  }
}
