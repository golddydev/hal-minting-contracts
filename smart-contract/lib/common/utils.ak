use aiken/builtin.{serialise_data}
use aiken/bytearray
use aiken/hash.{Blake2b_256, Hash}
use aiken/interval.{Finite}
use aiken/list
use aiken/pairs
use aiken/transaction.{
  Datum, DatumHash, InlineDatum, Input, Output, OutputReference, ValidityRange,
  find_input,
}
use aiken/transaction/credential.{
  Address, Inline, ScriptCredential, StakeCredential,
}
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

// get the start time of the transaction
// if the lower bound is inclusive, return the lower bound
// if the lower bound is exclusive, return the lower bound + 1
pub fn get_tx_start_time(self: ValidityRange) -> Int {
  when self.lower_bound.bound_type is {
    Finite(low) ->
      if self.lower_bound.is_inclusive {
        low
      } else {
        low + 1
      }
    _ -> fail @"transaction must have finite lower bound"
  }
}

pub fn get_datum_hash(datum: Datum) -> Hash<Blake2b_256, Data> {
  when datum is {
    DatumHash(hash) -> hash
    InlineDatum(data) -> hash.blake2b_256(serialise_data(data))
    _ -> fail @"no datum"
  }
}

pub fn bytearray_starts_with(self: ByteArray, target: ByteArray) -> Bool {
  let target_length = bytearray.length(target)
  ( self |> bytearray.take(target_length) ) == target
}
