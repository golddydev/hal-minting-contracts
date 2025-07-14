use aiken/fuzz
use aiken/interval.{entirely_after}
use aiken/list
use aiken/merkle_patricia_forestry.{
  Branch, Fork, Leaf, MerklePatriciaForestry, Proof, ProofStep,
} as mpt
use hal_nft_mint/whitelist.{WhitelistedItem}
use tests/mocks/fake_constants.{
  minting_start_time, one_hour_in_milliseconds, two_hours_in_milliseconds,
  user_1_address, user_2_address,
}
use validations/minting_data/types.{WhitelistProof}
use validations/minting_data/utils.{update_whitelist_mpt_root}

test can_whitelist_user_1_1() {
  let root = initial_trie()
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 5)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_1_1())

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

  new_root == trie_with_user_1_minted_3()
}

test cannot_whitelist_user_1_1_without_reducing_amount() fail {
  let root = initial_trie()
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 5)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_1_1())

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

  new_root == initial_trie()
}

test cannot_whitelist_user_1_1_with_invalid_whitelisted_item() fail {
  let root = initial_trie()
  // This is wrong whitelisted item, amount should be 5
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 10)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_1_1())

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

  new_root == initial_trie()
}

test can_whitelist_user_2_1() {
  let root = trie_with_user_1_minted_3()
  let whitelisted_item: WhitelistedItem = (one_hour_in_milliseconds, 10)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_2_1())

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

  new_root == trie_with_user_1_minted_3_user_2_minted_3()
}

test cannot_whitelist_user_2_1_before_one_hour() fail {
  let root = trie_with_user_1_minted_3()
  let whitelisted_item: WhitelistedItem = (one_hour_in_milliseconds, 10)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_2_1())

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

  new_root == trie_with_user_1_minted_3_user_2_minted_3()
}

test can_whitelist_user_1_2() {
  let root = trie_with_user_1_minted_3_user_2_minted_3()
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 2)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_1_2())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let new_root =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      2,
    )

  new_root == trie_with_user_1_minted_5_user_2_minted_3()
}

test cannot_whitelist_user_1_2_more_than_limit() fail {
  let root = trie_with_user_1_minted_3_user_2_minted_3()
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 2)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_1_2())

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

  new_root == trie_with_user_1_minted_5_user_2_minted_3()
}

test can_whitelist_user_2_2() {
  let root = trie_with_user_1_minted_5_user_2_minted_3()
  let whitelisted_item: WhitelistedItem = (one_hour_in_milliseconds, 7)
  let whitelist_proof: WhitelistProof = (whitelisted_item, proof_user_2_2())

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

  new_root == trie_with_user_1_minted_5_user_2_minted_6()
}

/// -------------------- Tries
///
/// An example trie made from a list of whitelisted addresses
/// user_1_address and user_2_address are whitelisted
///
/// user_1: 2 hours early, with amount limit of 5
/// user_2: 1 hour early, with amount limit of 10
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #840867f1e2f4f24794c91c1166fe0f1e806007da6da23a1811ab0344aa6f7d6b ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn initial_trie() -> MerklePatriciaForestry {
  mpt.from_root(
    #"840867f1e2f4f24794c91c1166fe0f1e806007da6da23a1811ab0344aa6f7d6b",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 2
/// user_2: 1 hour early, with amount limit of 10
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #86c2e7f31a8fd6101be48c524da4c43d7576e77a05b9eb148eab04accafd2ee1 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn trie_with_user_1_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"86c2e7f31a8fd6101be48c524da4c43d7576e77a05b9eb148eab04accafd2ee1",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted and user_2 minted 3 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 2
/// user_2: 1 hour early, with amount limit of 7
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #fc9de8ab39d365b05ed497c6983593899c65549472ca2dcbbf73fb4403cffcef ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn trie_with_user_1_minted_3_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"fc9de8ab39d365b05ed497c6983593899c65549472ca2dcbbf73fb4403cffcef",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 5 as whitelisted and user_2 minted 3 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 0
/// user_2: 1 hour early, with amount limit of 7
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #1b93986b858fa51a83d63836d4438d1df69185e57eb8dd32263a9b0c7898088c ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn trie_with_user_1_minted_5_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"1b93986b858fa51a83d63836d4438d1df69185e57eb8dd32263a9b0c7898088c",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 5 as whitelisted and user_2 minted 6 as whitelisted
///
/// user_1: 2 hours early, with amount limit of 0
/// user_2: 1 hour early, with amount limit of 4
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #2b959d8a4bd8ef7d6562d93fde0ca1de457a80bb4270eaadf84d832f6fa720cb ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn trie_with_user_1_minted_5_user_2_minted_6() -> MerklePatriciaForestry {
  mpt.from_root(
    #"2b959d8a4bd8ef7d6562d93fde0ca1de457a80bb4270eaadf84d832f6fa720cb",
  )
}

/// -------------------- Proofs
///
pub fn proof_user_1_1() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"5c6c4b76084e9a261de0a2c765f7863ee158a704d3be9fb61654351c3ac5b514",
    },
  ]
}

pub fn proof_user_2_1() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"11b2d2298b49942920b9aa27e72dfd76d841d7a3413be8264c819b3b83fe3de6",
    },
  ]
}

pub fn proof_user_1_2() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"dc3bee438af3d1e55b993984f0aa43fbb9494065cd8682ae6f6ae8c328fe87cf",
    },
  ]
}

pub fn proof_user_2_2() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"989534c9a35f5b7b20d72a2b009d39d49e290044c927446dd648408ce5bedb2e",
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
  mutation via fuzz_proof_mutation(proof_user_1_1()),
) fail {
  let root = initial_trie()
  let whitelisted_item: WhitelistedItem = (two_hours_in_milliseconds, 5)
  let whitelist_proof: WhitelistProof =
    (whitelisted_item, mutate(proof_user_1_1(), mutation))

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

  new_root == initial_trie()
}
