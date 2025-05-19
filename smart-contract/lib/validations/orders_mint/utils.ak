use aiken/transaction.{InlineDatum, Output}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId, Value}
use hal_nft_mint/orders.{OrderDatum, order_asset_name}

pub fn are_all_orders_minted(
  own_policy_id: PolicyId,
  hal_nft_price: Int,
  orders_spend_script_address: Address,
  destination_addresses: List<Address>,
  outputs: List<Output>,
  expected_mint_value: Value,
  continuation: fn(Value) -> result,
) -> result {
  when destination_addresses is {
    [] -> continuation(expected_mint_value)
    [destination_address, ..rest_destination_addresses] -> {
      // parse outputs
      expect [output, ..rest_outputs] = outputs

      let Output {
        address: output_address,
        datum: output_datum,
        value: output_value,
        reference_script: output_reference_script,
      } = output

      // output address must be order spend script address
      expect output_address == orders_spend_script_address

      // check output datum is order datum
      // and asset name and price and destination address
      // are correctly set
      expect InlineDatum(output_datum) = output_datum
      expect order_datum: OrderDatum = output_datum
      let OrderDatum {
        price,
        destination_address: output_destination_address,
        ..
      } = order_datum
      expect price == hal_nft_price
      expect output_destination_address == destination_address

      // check output value
      // has order token and correct amount of lovelace (hal_nft_price)
      let has_order_token =
        value.without_lovelace(output_value) == (
          value.zero()
            |> value.add(own_policy_id, order_asset_name, 1)
        )
      let has_enough_lovelace = value.lovelace_of(output_value) >= hal_nft_price
      expect has_order_token && has_enough_lovelace

      // check output reference script is none
      expect output_reference_script == None

      // update expected mint value
      let new_expected_mint_value =
        expected_mint_value |> value.add(own_policy_id, order_asset_name, 1)

      // continue with rest of orders
      are_all_orders_minted(
        own_policy_id,
        hal_nft_price,
        orders_spend_script_address,
        rest_destination_addresses,
        rest_outputs,
        new_expected_mint_value,
        continuation,
      )
    }
  }
}
