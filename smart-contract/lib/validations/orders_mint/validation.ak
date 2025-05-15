use aiken/list
use aiken/transaction.{Transaction}
use aiken/transaction/credential.{Address}
use aiken/transaction/value.{PolicyId}
use hal_nft_mint/orders.{order_asset_name}
use hal_nft_mint/settings.{Settings, find_settings}
use hal_nft_mint/settings_v1.{SettingsV1}
use validations/orders_mint/utils.{are_all_orders_minted}

// Validation:
// When user requests Order(s) to mint H.A.L. NFT(s)
//
// Checks:
// - must attach Setting in reference inputs
// - own minting policy id must be same as orders_mint_policy_id from Settings
// - must be signed by orders_minter
// - all Orders NFTs are minted correctly
//   and sent to orders_spend_script_address 
//   with correct amount of lovelace and one Order NFT and valid datum
//   (destination address, price, owner key hash)
// - must mint only Order NFTs
//
pub fn can_mint_orders(
  destination_addresses: List<Address>,
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
    ..
  } = settings_datum

  // own minting policy id must be same as orders_mint_policy_id from Settings
  expect orders_mint_policy_id == own_policy_id

  // must be signed by orders_minter
  let is_orders_minter_signed = list.has(extra_signatories, orders_minter)
  expect is_orders_minter_signed

  // all Orders NFTs are minted correctly
  // and sent to orders_spend_script_address 
  // with correct amount of lovelace and one Order NFT and valid datum
  let expected_mint_value <-
    are_all_orders_minted(
      own_policy_id,
      hal_nft_price,
      orders_spend_script_address,
      destination_addresses,
      outputs,
      value.zero(),
    )

  // must mint only Order NFTs
  expect value.from_minted_value(mint) == expected_mint_value

  True
}

// Validation:
// When minting engine mint H.A.L. NFTs spending Orders UTxO and burning Orders NFTs
//
// Checks:
// - must mint H.A.L. NFT(s)
//
pub fn can_execute_orders(
  transaction: Transaction,
  hal_policy_id: PolicyId,
) -> Bool {
  let Transaction { mint, .. } = transaction

  // must mint H.A.L. NFT(s)
  // (because H.A.L. burn is not supported, we don't check amount)
  let is_hal_minted =
    mint |> value.from_minted_value |> value.policies |> list.has(hal_policy_id)
  expect is_hal_minted

  True
}

// Validation:
// When user tries to cancel Order
//
// Checks:
// - must burn only one Order NFT
//
pub fn can_cancel_order(policy_id: PolicyId, transaction: Transaction) -> Bool {
  let Transaction { mint, .. } = transaction

  // must burn only one Order NFT
  let only_burn_one_order_token =
    value.from_minted_value(mint) == (
      value.zero()
        |> value.add(policy_id, order_asset_name, -1)
    )
  expect only_burn_one_order_token

  True
}
