use aiken/list
use aiken/transaction.{Transaction}
use aiken/transaction/value.{PolicyId}
use hal_nft_mint/orders.{Order, order_asset_name}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/orders_mint/utils.{are_all_order_outputs_valid}

// Validation:
// When user requests Orders to mint H.A.L. NFTs
//
// Checks:
// - must attach Setting in reference inputs
// - own minting policy id must be same as orders_mint_policy_id from Settings
// - must be signed by orders_minter
// - all Order NFTs must be minted correctly for all Orders
//   amount must be positive
//   amount must not exceed max_order_amount
//   must have valid Order output
//   address must be orders_spend_script_address
//   must have valid `OrderDatum` with matching destination_address and amount
//   must have only one Order NFT and enough lovelace
// - must mint only one Order NFT
//
pub fn can_mint_orders(
  orders: List<Order>,
  own_policy_id: PolicyId,
  transaction: Transaction,
) -> Bool {
  let Transaction { outputs, reference_inputs, extra_signatories, mint, .. } =
    transaction

  // must attach Setting in reference inputs
  let Settings { data: settings_data, .. } = find_settings(reference_inputs)
  expect settings_datum: SettingsV1 = settings_data
  let SettingsV1 {
    hal_nft_price,
    orders_spend_script_address,
    orders_mint_policy_id,
    orders_minter,
    max_order_amount,
    ..
  } = settings_datum

  // own minting policy id must be same as orders_mint_policy_id from Settings
  expect orders_mint_policy_id == own_policy_id

  // must be signed by orders_minter
  let is_orders_minter_signed = list.has(extra_signatories, orders_minter)
  expect is_orders_minter_signed

  // all Order NFTs must be minted correctly for all Orders
  let all_order_outputs_valid =
    are_all_order_outputs_valid(
      orders,
      outputs,
      own_policy_id,
      hal_nft_price,
      orders_spend_script_address,
      max_order_amount,
    )
  expect all_order_outputs_valid

  // must mint correct amount Order NFTs
  let orders_count = list.length(orders)
  let expected_minted_value =
    value.zero() |> value.add(own_policy_id, order_asset_name, orders_count)
  expect value.from_minted_value(mint) == expected_minted_value

  True
}

// Validation:
// When burn Order NFts
//
// Checks:
// - must only burn Order NFTs
//
// NOTE:
// once Order UTxO with Order NFT is spent, Order NFT can be spent any time.

pub fn can_burn_orders(
  transaction: Transaction,
  own_policy_id: PolicyId,
) -> Bool {
  let Transaction { mint, .. } = transaction

  // must only burn Order NFTs
  let minted_value = value.from_minted_value(mint)
  let only_burn_order_nfts =
    when minted_value |> value.flatten is {
      [(policy_id, asset_name, quantity)] -> {
        let is_policy_id_correct = policy_id == own_policy_id
        let is_asset_name_correct = asset_name == order_asset_name
        let must_only_burn = quantity < 0

        expect is_policy_id_correct
        expect is_asset_name_correct
        expect must_only_burn
        True
      }
      _ -> {
        trace @"must only burn Order NFTs"
        False
      }
    }

  expect only_burn_order_nfts
  True
}
