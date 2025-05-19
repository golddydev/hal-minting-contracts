use aiken/transaction.{ScriptContext, WithdrawFrom}
use common/hashes.{ScriptHash}
use validations/mint_v1/validation.{can_mint_nfts}

type MintV1Redeemer {
  MintNFTs
  BurnNFTs
}

// NOTE:
// Withdrawal validator which holds all minting logic
// This is referred to as `mint_governor` in Settings datum
//
// ======= Parameters =======
// `minting_data_script_hash`: Script hash of current minting data script
// which is referred from SettingsV1
//
validator(minting_data_script_hash: ScriptHash) {
  fn withdraw(redeemer: MintV1Redeemer, ctx: ScriptContext) -> Bool {
    let ScriptContext { purpose, transaction } = ctx
    expect WithdrawFrom(_) = purpose

    when redeemer is {
      MintNFTs -> can_mint_nfts(transaction, minting_data_script_hash)
      BurnNFTs -> {
        trace @"Burn is disabled now"
        False
      }
    }
  }
}
