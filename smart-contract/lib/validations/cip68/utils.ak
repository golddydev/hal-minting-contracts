use aiken/list
use aiken/transaction.{Input, Output}
use aiken/transaction/value.{AssetName, PolicyId}

pub fn does_spend_user_asset(
  inputs: List<Input>,
  hal_policy_id: PolicyId,
  user_asset_name: AssetName,
) -> Bool {
  inputs
    |> list.any(
        fn(input: Input) -> Bool {
          let Input { output: Output { value: v, .. }, .. } = input
          let has_user_asset =
            ( v |> value.quantity_of(hal_policy_id, user_asset_name) ) > 0
          has_user_asset
        },
      )
}
