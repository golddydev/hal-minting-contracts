use aiken/transaction.{Mint, ScriptContext}
use hal_nft_mint/orders.{Order}
use validations/orders_mint/validation.{can_burn_orders, can_mint_orders}

type OrderMintRedeemer {
  MintOrders(List<Order>)
  BurnOrders
}

// This is Minting Policy for Order NFTs
// Order NFTs are used to check UTxOs in Orders Spend validator
// are valid
//
// When mint Order NFTs, the NFTs must be sent to `orders_spend` script address 
// one order will have one each UTxO
// once that UTxO with Order NFT can be spent, the NFT can be burnt any time
//
validator {
  fn mint(redeemer: OrderMintRedeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext { transaction, purpose } = ctx
    expect Mint(policy_id) = purpose

    when redeemer is {
      MintOrders(orders) -> can_mint_orders(orders, policy_id, transaction)
      BurnOrders -> can_burn_orders(transaction, policy_id)
    }
  }
}
