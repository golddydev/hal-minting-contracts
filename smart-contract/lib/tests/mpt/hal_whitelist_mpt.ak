use aiken/fuzz
use aiken/interval.{after, entirely_after}
use aiken/list
use aiken/merkle_patricia_forestry.{
  Branch, Fork, Leaf, MerklePatriciaForestry, Proof, ProofStep,
} as mpt
use hal_nft_mint/whitelist.{WhitelistedItem, WhitelistedValue}
use tests/mocks/fake_constants.{
  minting_start_time, one_hour_in_milliseconds, two_hours_in_milliseconds,
  user_1_address, user_2_address, whitelisted_price_1, whitelisted_price_2,
}
use validations/minting_data/types.{WhitelistProof}
use validations/minting_data/utils.{update_whitelist_mpt_root}

test can_whitelist_user_1_1() {
  let root = whitelist_initial_trie()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range = after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}

test cannot_whitelist_user_1_1_without_reducing_amount() fail {
  let root = whitelist_initial_trie()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_initial_trie()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}

test cannot_whitelist_user_1_1_with_invalid_whitelisted_item() fail {
  let root = whitelist_initial_trie()
  // This is wrong whitelisted value, amount should be 5
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 10,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}

test can_whitelist_user_2_1() {
  let root = whitelist_trie_with_user_1_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 10,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_1())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3_user_2_minted_3()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 3
  True
}

test can_whitelist_user_2_1_before_one_hour_without_change() {
  let root = whitelist_trie_with_user_1_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 10,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3()
  expect remaining_ordered_amount == 3
  expect spent_lovelace_for_whitelisted == 0
  True
}

test cannot_whitelist_user_2_1_before_one_hour() fail {
  let root = whitelist_trie_with_user_1_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 10,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_1())

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3_user_2_minted_3()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 3
  True
}

test can_whitelist_user_1_2() {
  let root = whitelist_trie_with_user_1_minted_3_user_2_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 2,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_2())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_6_user_2_minted_3()
  expect remaining_ordered_amount == 0
  expect
    spent_lovelace_for_whitelisted == whitelisted_price_1 * 2 + whitelisted_price_2 * 1
  True
}

test can_whitelist_user_2_2() {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_3()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 7,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_2_2())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_2_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_6_user_2_minted_6()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 3
  True
}

test can_whitelist_user_1_3() {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_6()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 2,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_3())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      2,
    )

  expect new_root == whitelist_trie_with_user_1_minted_8_user_2_minted_6()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 2
  True
}

test can_whitelist_user_1_3_more_than_limit_with_remaining_ordered_amount() {
  let root = whitelist_trie_with_user_1_minted_6_user_2_minted_6()
  let whitelisted_value: WhitelistedValue =
    [
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 2,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, whitelist_proof_user_1_3())

  let validity_range =
    entirely_after(minting_start_time - one_hour_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_8_user_2_minted_6()
  expect remaining_ordered_amount == 1
  expect spent_lovelace_for_whitelisted == whitelisted_price_2 * 2
  True
}

/// -------------------- Tries
///
/// An example trie made from a list of whitelisted addresses
/// user_1_address and user_2_address are whitelisted
///
/// user_1: (2 hours, limit of 5, 150 ada) & (1 hour, limit of 3, 160 ada)
/// user_2: (1 hour, limit of 10, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #fe301fd1272c2d9e3db9aa45cb7dd8604f474c096fe9960daddbcb23d18a5006 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_initial_trie() -> MerklePatriciaForestry {
  mpt.from_root(
    #"fe301fd1272c2d9e3db9aa45cb7dd8604f474c096fe9960daddbcb23d18a5006",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
///
/// user_1: (2 hours, limit of 2, 150 ada) & (1 hour, limit of 3, 160 ada)
/// user_2: (1 hour, limit of 10, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #73d4c1dbfd6ccfca0c235d2db5e4d276b81b1583186ec382e803903fc601ca47 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"73d4c1dbfd6ccfca0c235d2db5e4d276b81b1583186ec382e803903fc601ca47",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
///
/// user_1: (2 hours, limit of 2, 150 ada) & (1 hour, limit of 3, 160 ada)
/// user_2: (1 hour, limit of 7, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #2eb8b0e244a5cffce74bb4cf91367d8f1a0650cde6872b1213d0c482f0e9383b ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_3_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"2eb8b0e244a5cffce74bb4cf91367d8f1a0650cde6872b1213d0c482f0e9383b",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
/// user_1 minted 3 as whitelisted
///
/// user_1: (1 hour, limit of 2, 160 ada)
/// user_2: (1 hour, limit of 7, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #91a14cec99418432faae236ea0010038d6c1de526e4b51a8e81d60b4be4d6054 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_6_user_2_minted_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"91a14cec99418432faae236ea0010038d6c1de526e4b51a8e81d60b4be4d6054",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
///
/// user_1: (1 hour, limit of 2, 160 ada)
/// user_2: (1 hour, limit of 4, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #de98cd5a611138cf97c15bd26f903aaf5f99e4522124eca57a7e95d363ac956e ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_6_user_2_minted_6() -> MerklePatriciaForestry {
  mpt.from_root(
    #"de98cd5a611138cf97c15bd26f903aaf5f99e4522124eca57a7e95d363ac956e",
  )
}

/// An example trie made from a list of whitelisted addresses
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
/// user_1 minted 3 as whitelisted
/// user_2 minted 3 as whitelisted
/// user_1 minted 2 as whitelisted
///
/// user_1: empty
/// user_2: (1 hour, limit of 4, 160 ada)
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #8486aa3755bd146b16c4f06cb55b99837d644d27ec9bc2f1f638397bacf490f9 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
pub fn whitelist_trie_with_user_1_minted_8_user_2_minted_6() -> MerklePatriciaForestry {
  mpt.from_root(
    #"8486aa3755bd146b16c4f06cb55b99837d644d27ec9bc2f1f638397bacf490f9",
  )
}

/// -------------------- Proofs
///
pub fn whitelist_proof_user_1_1() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"2aed18e98f739825dc6a9569f53254d400339a84f7deee9f4883644b35cd8bd5",
    },
  ]
}

pub fn whitelist_proof_user_2_1() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"4966cf503a375578354cf5c6cb56e7674e0d59e9de8bad82768bde4e052edb6d",
    },
  ]
}

pub fn whitelist_proof_user_1_2() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"c47c15918868e18e55a7e0a91138d62e0c96d66d94a59e6deac1ceb361996834",
    },
  ]
}

pub fn whitelist_proof_user_2_2() {
  [
    Leaf {
      skip: 0,
      key: #"6482c0f4a6287eb27b89e542e7cd4bf488ca34530e1a65ff01b7808cac828cfd",
      value: #"705bec69340d412bb8cb32fc83ee1d75dc9e46b85be72b9bd090efaec2d3f764",
    },
  ]
}

pub fn whitelist_proof_user_1_3() {
  [
    Leaf {
      skip: 0,
      key: #"8188ef8a03470e0e2ed7b58cf09a398b302484f4be054312dc46a15023aeb65b",
      value: #"e5f358d0b1bc23396d598acc2c4b696126b138a24371c7b893985fb177e84571",
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
    [
      WhitelistedItem {
        time_gap: two_hours_in_milliseconds,
        amount: 5,
        price: whitelisted_price_1,
      },
      WhitelistedItem {
        time_gap: one_hour_in_milliseconds,
        amount: 3,
        price: whitelisted_price_2,
      },
    ]
  let whitelist_proof: WhitelistProof =
    (whitelisted_value, mutate(whitelist_proof_user_1_1(), mutation))

  let validity_range =
    entirely_after(minting_start_time - two_hours_in_milliseconds)
  let (new_root, remaining_ordered_amount, spent_lovelace_for_whitelisted) =
    update_whitelist_mpt_root(
      root,
      whitelist_proof,
      validity_range,
      minting_start_time,
      user_1_address(),
      3,
    )

  expect new_root == whitelist_trie_with_user_1_minted_3()
  expect remaining_ordered_amount == 0
  expect spent_lovelace_for_whitelisted == whitelisted_price_1 * 3
  True
}
