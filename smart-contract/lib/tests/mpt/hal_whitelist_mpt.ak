use aiken/fuzz
use aiken/interval.{after, entirely_after}
use aiken/list
use aiken/merkle_patricia_forestry.{
  Branch, Fork, Leaf, MerklePatriciaForestry, Proof, ProofStep,
} as mpt
use hal_nft_mint/whitelist.{WhitelistedItem, WhitelistedValue}
use tests/mocks/fake_constants.{
  minting_start_time, one_hour_in_milliseconds, two_hours_in_milliseconds,
  user_1_address, user_2_address,
}
use validations/minting_data/types.{WhitelistProof}
use validations/minting_data/utils.{update_whitelist_mpt_root}

test can_whitelist_user_1_1() {
  let root = whitelist_initial_trie()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range = after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_3()
}

test cannot_whitelist_user_1_1_without_reducing_amount() fail {
  let root = whitelist_initial_trie()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_initial_trie()
}

test cannot_whitelist_user_1_1_with_invalid_whitelisted_item() fail {
  let root = whitelist_initial_trie()
  // This is wrong whitelisted value, amount should be 5
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 10 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_3()
}

test can_whitelist_user_2_1() {
  let root = whitelist_trie_with_user_1_minted_3()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 10 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_1())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_3_user_2_minted_3()
}

test cannot_whitelist_user_2_1_before_one_hour() fail {
  let root = whitelist_trie_with_user_1_minted_3()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 10 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_3_user_2_minted_3()
}

test can_whitelist_user_1_2() {
  let root = whitelist_trie_with_user_1_minted_3_user_2_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 2 },
      WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 3 },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_2())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_6_user_2_minted_3()
}

test can_whitelist_user_2_2() {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_3()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 7 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_2())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_6_user_2_minted_6()
}

test can_whitelist_user_1_3() {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_6()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 2 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_3())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      2,
    )

  new_root == whitelist_trie_with_user_1_minted_8_user_2_minted_6()
}

test cannot_whitelist_user_1_3_more_than_limit() fail {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_6()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: one_hour_in_milliseconds, amount: 2 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_3())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_trie_with_user_1_minted_8_user_2_minted_6()
}

/// -------------------- Tries
///
/// An example trie made from a list of whitelisted addresses
/// user_1_address and user_2_address are whitelisted
///
/// user_1: 2 hours early, with amount limit of 5 & 1 hour early, with amount limit of 3
/// user_2: 1 hour early, with amount limit of 10
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #268852a340183f9e7496505cdde701f91794ba08438d51e64dfadef2fc05403f ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_initial_trie() -> MerklePatriciaForestry {
  mpt.from_root(
    #"268852a340183f9e7496505cdde701f91794ba08438d51e64dfadef2fc05403f",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 2 & 1 hour early, with amount limit of 3
/// user_2: 1 hour early, with amount limit of 10
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #f5c9f972f62faef8583cf31c1175d825e8550cbe3e87cc210754d54859525537 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"f5c9f972f62faef8583cf31c1175d825e8550cbe3e87cc210754d54859525537",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted and user_2 minted 3 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 2 & 1 hour early, with amount limit of 3
/// user_2: 1 hour early, with amount limit of 7
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #6d384d99a23b43e5bab7aa9d72bdba8615e670d5a82f38511ba14466abcd5079 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_3_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"6d384d99a23b43e5bab7aa9d72bdba8615e670d5a82f38511ba14466abcd5079",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 6 as whitelisted and user_2 minted 3 as whitelisted
///
/// user_1: 1 hour early, with amount limit of 2
/// user_2: 1 hour early, with amount limit of 7
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #3b7bc36db2673d04e998ca515ebbb5e2c8741637a8de096a481a87642806231d ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_6_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"3b7bc36db2673d04e998ca515ebbb5e2c8741637a8de096a481a87642806231d",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 6 as whitelisted and user_2 minted 6 as whitelisted
///
/// user_1: 1 hour early, with amount limit of 2
/// user_2: 1 hour early, with amount limit of 4
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #09287568e5daa5bf53f6b545e6ac4e972c98d9382dbaaa5298e2219ec117ee9e ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_6_user_2_minted_6() -> MerklePatriciaForestry {
  mpt.from_root(
    #"09287568e5daa5bf53f6b545e6ac4e972c98d9382dbaaa5298e2219ec117ee9e",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 8 as whitelisted and user_2 minted 6 as whitelisted
///
/// user_2: 1 hour early, with amount limit of 4
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #8d83eb99348b0bfcbc5e925228677db709da9701e8bbf6934d568fcacd7b5491 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_8_user_2_minted_6() -> MerklePatriciaForestry {
  mpt.from_root(
    #"8d83eb99348b0bfcbc5e925228677db709da9701e8bbf6934d568fcacd7b5491",
  )
}

/// -------------------- Proofs
///
pub fn whitelist_proof_user_1_1() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"763157e82407dd2027e9206d1b8f4a4f7450b432c558fef5e286bcd61216e8eb",
    },
  ]
}

pub fn whitelist_proof_user_2_1() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"431747d12dc4daf007896a029ed92d148d67dc6feab527e5a8eacffbf2874668",
    },
  ]
}

pub fn whitelist_proof_user_1_2() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"1dab3924341ece631e2e334832c35b761645d76c0d769d186d15f70e327b0305",
    },
  ]
}

pub fn whitelist_proof_user_2_2() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"417ef7441bb6de052b4923d0d4514c28aa771c654ba5bddc889fd352545a994a",
    },
  ]
}

pub fn whitelist_proof_user_1_3() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"a3e07dc82ea49819f2de698344cef63adb2582d6f42eabbadecb259e55c4adfc",
    },
  ]
}

/// -------------------- Mutations
type ProofMutation {
  RemoveStepAt(Int)
  InsertStepAt(Int, ProofStep)
  IncrementSkipAt(Int)
}

fn fuzz_proof_mutation(proof: Proof) -> Fuzzer<ProofMutation> {
  expect !list.is_empty(proof)

  let choice <- fuzz.and_then(fuzz.int_between(0, 1))

  when choice is {
    0 -> {
      let ix <- fuzz.map(fuzz.int_between(0, list.length(proof) - 1))
      RemoveStepAt(ix)
    }

    1 -> {
      let ix <- fuzz.and_then(fuzz.int_between(0, list.length(proof)))
      let key <- fuzz.and_then(fuzz.bytearray_between(32, 32))
      let value <- fuzz.map(fuzz.bytearray_between(32, 32))
      InsertStepAt(ix, Leaf { skip: 0, key, value })
    }

    2 -> {
      let ix <- fuzz.map(fuzz.int_between(0, list.length(proof) - 1))
      IncrementSkipAt(ix)
    }

    _ -> fail @"unexpected choice"
  }
}

fn mutate(proof: Proof, mutation: ProofMutation) -> Proof {
  when mutation is {
    RemoveStepAt(ix) ->
      list.concat(list.take(proof, ix - 1), list.drop(proof, ix + 1))

    InsertStepAt(ix, step) ->
      list.concat(list.take(proof, ix), [step, ..list.drop(proof, ix)])

    IncrementSkipAt(ix) -> {
      let step =
        when list.at(proof, ix) is {
          Some(Branch { skip, neighbors }) ->
            Branch { skip: skip + 1, neighbors }
          Some(Fork { skip, neighbor }) -> Fork { skip: skip + 1, neighbor }
          Some(Leaf { skip, key, value }) -> Leaf { skip: skip + 1, key, value }
          _ -> fail @"invalid 'IncrementSkipAt' mutation generated"
        }
      list.concat(list.take(proof, ix - 1), [step, ..list.drop(proof, ix + 1)])
    }
  }
}

test cannot_whitelist_user_1_1_with_invalid_proof(
  mutation via fuzz_proof_mutation(whitelist_proof_user_1_1()),
) fail {
  let root = whitelist_initial_trie()
  let whitelisted_value: WhitelistedValue =
    [WhitelistedItem { time_gap: two_hours_in_milliseconds, amount: 5 }]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, mutate(whitelist_proof_user_1_1(), mutation))

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  new_root == whitelist_initial_trie()
}
