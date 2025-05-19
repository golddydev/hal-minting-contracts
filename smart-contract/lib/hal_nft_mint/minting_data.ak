use aiken/list
use aiken/transaction.{InlineDatum, Input, Output}
use aiken/transaction/value

const minting_data_asset_policy_id =
  #"f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a"

// root@hal_mint
// hold minting data like mpt root hash
// NOTE: 
// must be spent every time 
// a new hal is minted
const minting_data_asset_name = #"000de140726f6f744068616c5f6d696e74"

// Minted H.A.L. NFT's Value of MPT
pub const mpt_minted_value = "minted"

pub type MintingData {
  // mpt root hash
  mpt_root_hash: ByteArray,
}

pub fn find_minting_data(inputs: List<Input>) -> (Output, MintingData) {
  expect Some(minting_data_input) =
    list.find(
      inputs,
      fn(i) {
        value.quantity_of(
          i.output.value,
          minting_data_asset_policy_id,
          minting_data_asset_name,
        ) == 1
      },
    )
  expect InlineDatum(inline_minting_data) = minting_data_input.output.datum
  expect minting_data: MintingData = inline_minting_data
  (minting_data_input.output, minting_data)
}

// this function also makes sure that
// output has minting data asset
// with correct MintingData datum
pub fn resolve_minting_data(output: Output) -> MintingData {
  // check output has minting data asset
  expect
    value.quantity_of(
      output.value,
      minting_data_asset_policy_id,
      minting_data_asset_name,
    ) == 1

  // resolve minting data datum
  expect InlineDatum(inline_minting_data) = output.datum
  expect minting_data: MintingData = inline_minting_data

  minting_data
}
