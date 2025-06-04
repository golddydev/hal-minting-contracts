use aiken/transaction.{InlineDatum, Output}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId}
use hal_nft_mint/orders.{Order, OrderDatum, order_asset_name}

pub fn are_all_order_outputs_valid(
  orders: List<Order>,
  order_outputs: List<Output>,
  own_policy_id: PolicyId,
  hal_nft_price: Int,
  orders_spend_script_address: Address,
  max_order_amount: Int,
) -> Bool {
  when orders is {
    [] -> True
    [order, ..rest_orders] -> {
      expect [order_output, ..rest_order_outputs] = order_outputs
      let order_output_valid =
        is_order_output_valid(
          order,
          order_output,
          own_policy_id,
          hal_nft_price,
          orders_spend_script_address,
          max_order_amount,
        )
      order_output_valid && are_all_order_outputs_valid(
        rest_orders,
        rest_order_outputs,
        own_policy_id,
        hal_nft_price,
        orders_spend_script_address,
        max_order_amount,
      )
    }
  }
}

fn is_order_output_valid(
  order: Order,
  order_output: Output,
  own_policy_id: PolicyId,
  hal_nft_price: Int,
  orders_spend_script_address: Address,
  max_order_amount: Int,
) -> Bool {
  let (destination_address, amount) = order
  let Output {
    address: output_address,
    datum: output_datum,
    value: output_value,
    reference_script: output_reference_script,
  } = order_output

  // amount must be positive
  expect amount > 0

  // amount must not exceed max_order_amount
  expect amount <= max_order_amount

  // output address must be order spend script address
  expect output_address == orders_spend_script_address

  // check output datum is order datum
  // and asset name and price and destination address and amount
  // are correctly set
  expect InlineDatum(output_datum) = output_datum
  expect order_datum: OrderDatum = output_datum
  let OrderDatum {
    price,
    destination_address: order_destination_address,
    amount: order_amount,
    ..
  } = order_datum
  expect price == hal_nft_price
  expect order_destination_address == destination_address
  expect order_amount == amount

  // order mint value
  let order_output_value =
    value.zero() |> value.add(own_policy_id, order_asset_name, 1)

  // check output value
  // has order token and correct amount of lovelace (hal_nft_price)
  let has_order_token =
    value.without_lovelace(output_value) == order_output_value
  let has_enough_lovelace =
    value.lovelace_of(output_value) >= hal_nft_price * amount
  expect has_order_token && has_enough_lovelace

  // check output reference script is none
  expect output_reference_script == None

  True
}
