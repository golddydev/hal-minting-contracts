use aiken/transaction.{ScriptContext, Spend}
use aiken/transaction/value.{PolicyId}
use hal_nft_mint/orders.{OrderDatum}
use validations/orders_spend/validation.{can_cancel_order, can_execute_orders}

type OrderSpendRedeemer {
  ExecuteOrders
  CancelOrder
}

// This is Spending validator
// Where Order Tx Input is sent
// with Order NFT (orders_mint)
//
// ===== Parameters =====
// `hal_policy_id`: Policy id of HAL NFT
// `orders_mint_policy_id`: Policy id of Order NFT
//
validator(hal_policy_id: PolicyId, orders_mint_policy_id: PolicyId) {
  fn spend(
    datum: OrderDatum,
    redeemer: OrderSpendRedeemer,
    ctx: ScriptContext,
  ) -> Bool {
    let ScriptContext(transaction, purpose) = ctx
    expect Spend(spending_output_reference) = purpose

    when redeemer is {
      ExecuteOrders -> can_execute_orders(transaction, hal_policy_id)
      CancelOrder ->
        can_cancel_order(
          transaction,
          datum,
          spending_output_reference,
          orders_mint_policy_id,
        )
    }
  }
}
