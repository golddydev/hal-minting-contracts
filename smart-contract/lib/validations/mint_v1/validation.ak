use aiken/transaction.{Output, Transaction}
use aiken/transaction/credential.{Address, ScriptCredential}
use common/hashes.{ScriptHash}
use hal_nft_mint/minting_data.{find_minting_data}

// Validation:
// Main validation logic for new handles' minting
//
// Checks
// - minting_data asset is spent from minting_data_script from parameter
//
pub fn can_mint_nfts(
  transaction: Transaction,
  minting_data_script_hash: ScriptHash,
) -> Bool {
  trace @"can_mint_nfts"
  let Transaction { inputs, .. } = transaction

  // minting_data asset is spent from minting_data_script from parameter
  let (minting_data_input, _) = find_minting_data(inputs)
  expect
    minting_data_input.address.payment_credential == ScriptCredential(
      minting_data_script_hash,
    )

  True
}
