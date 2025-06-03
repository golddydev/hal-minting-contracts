use aiken/builtin.{serialise_data}
use aiken/dict.{Dict}
use aiken/hash.{Blake2b_256, Hash}
use aiken/list
use aiken/pairs
use aiken/transaction.{
  Datum, DatumHash, InlineDatum, Input, Output, OutputReference, find_input,
}
use aiken/transaction/credential.{
  Address, Inline, ScriptCredential, StakeCredential,
}
use aiken/transaction/value.{AssetName}
use common/hashes.{ScriptHash}

pub fn is_withdrawal_script_executed(
  withdrawals: Pairs<StakeCredential, Int>,
  script_hash: ScriptHash,
) -> Bool {
  pairs.has_key(withdrawals, Inline(ScriptCredential(script_hash)))
}

pub fn get_own_utxo(
  inputs: List<Input>,
  spending_output_reference: OutputReference,
) -> Output {
  expect Some(spending_input) = find_input(inputs, spending_output_reference)
  spending_input.output
}

pub fn get_own_script_hash(own_utxo: Output) -> ScriptHash {
  let Output { address: Address { payment_credential, .. }, .. } = own_utxo
  expect ScriptCredential(spending_script_hash) = payment_credential

  spending_script_hash
}

pub fn get_own_utxos_count(
  inputs: List<Input>,
  own_script_hash: ScriptHash,
) -> Int {
  let own_utxo_count =
    inputs
      |> list.count(
          fn(input: Input) -> Bool {
            let Input {
              output: Output { address: Address { payment_credential, .. }, .. },
              ..
            } = input
            when payment_credential is {
              ScriptCredential(script_hash) -> script_hash == own_script_hash
              _ -> False
            }
          },
        )
  own_utxo_count
}

pub fn get_datum_hash(datum: Datum) -> Hash<Blake2b_256, Data> {
  when datum is {
    DatumHash(hash) -> hash
    InlineDatum(data) -> hash.blake2b_256(serialise_data(data))
    _ -> fail @"no datum"
  }
}

pub fn are_tokens_same(
  tokens_1: Dict<AssetName, Int>,
  tokens_2: Dict<AssetName, Int>,
) -> Bool {
  dict.foldl(
    tokens_1,
    True,
    fn(asset_name, quantity, result) -> Bool {
      result && dict.get(tokens_2, asset_name) == Some(quantity)
    },
  )
}
