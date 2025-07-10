use aiken/fuzz
use aiken/list
use aiken/merkle_patricia_forestry.{
  Branch, Fork, Leaf, MerklePatriciaForestry, Proof, ProofStep,
} as mpt

const mpt_minted_value = "minted"

const wrong_mpt_minted_value = "wrong"

test can_mint_hal_2() {
  let root = initial_trie()
  let new_root =
    root |> mpt.update("hal-2", proof_hal_2(), #"", mpt_minted_value)

  new_root == trie_with_hal_2()
}

test cannot_mint_hal_2_again() fail {
  let root = trie_with_hal_2()
  let new_root =
    root |> mpt.update("hal-2", proof_hal_2(), #"", mpt_minted_value)

  new_root == trie_with_hal_2()
}

test cannot_mint_hal_2_with_wrong_minted_value() fail {
  let root = initial_trie()
  let new_root =
    root |> mpt.update("hal-2", proof_hal_2(), #"", wrong_mpt_minted_value)

  new_root == trie_with_hal_2()
}

test can_mint_hal_3() {
  let root = trie_with_hal_2()
  let new_root =
    root |> mpt.update("hal-3", proof_hal_3(), #"", mpt_minted_value)

  new_root == trie_with_hal_2_3()
}

test cannot_mint_hal_3_again() fail {
  let root = trie_with_hal_2_3()
  let new_root =
    root |> mpt.update("hal-3", proof_hal_3(), #"", mpt_minted_value)

  new_root == trie_with_hal_2_3()
}

test cannot_mint_hal_3_with_wrong_minted_value() fail {
  let root = trie_with_hal_2()
  let new_root =
    root |> mpt.update("hal-3", proof_hal_3(), #"", wrong_mpt_minted_value)

  new_root == trie_with_hal_2_3()
}

test can_mint_hal_5() {
  let root = trie_with_hal_2_3()
  let new_root =
    root |> mpt.update("hal-5", proof_hal_5(), #"", mpt_minted_value)

  new_root == trie_with_hal_2_3_5()
}

test can_mint_hal_5_again() fail {
  let root = trie_with_hal_2_3_5()
  let new_root =
    root |> mpt.update("hal-5", proof_hal_5(), #"", mpt_minted_value)

  new_root == trie_with_hal_2_3_5()
}

test cannot_mint_hal_5_with_wrong_minted_value() fail {
  let root = trie_with_hal_2_3()
  let new_root =
    root |> mpt.update("hal-5", proof_hal_5(), #"", wrong_mpt_minted_value)

  new_root == trie_with_hal_2_3_5()
}

/// -------------------- Tries
///
/// An example trie made from a list of HALs
/// hal-1 ~ hal-100 with value as empty string `""`
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #264814436b0b358963bd767435419d4f5def53eb2db23708b4f831e6aaba6ba0 ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
fn initial_trie() -> MerklePatriciaForestry {
  mpt.from_root(
    #"264814436b0b358963bd767435419d4f5def53eb2db23708b4f831e6aaba6ba0",
  )
}

/// An example trie made from a list of HALs
/// hal-2 is minted
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #0e79e0d805200085e0bc4859e11a7507aa64dc382ba13b69268dff6884b536cf ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
fn trie_with_hal_2() -> MerklePatriciaForestry {
  mpt.from_root(
    #"0e79e0d805200085e0bc4859e11a7507aa64dc382ba13b69268dff6884b536cf",
  )
}

/// An example trie made from a list of HALs
/// hal-2 and hal-3 are minted
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #95216218c8f1e8d80a65165f7bcda94cd2dfbb73fff5f3efb4b916cbb7f7e5ad ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
fn trie_with_hal_2_3() -> MerklePatriciaForestry {
  mpt.from_root(
    #"95216218c8f1e8d80a65165f7bcda94cd2dfbb73fff5f3efb4b916cbb7f7e5ad",
  )
}

/// An example trie made from a list of HALs
/// hal-2, hal-3, hal-5 are minted
///
///   ╔═══════════════════════════════════════════════════════════════════╗
///   ║ #2de0b0ad5346df469e08e403ae13dc9bf5606464564f03d5aa769049cce2257e ║
///   ╚═══════════════════════════════════════════════════════════════════╝
///
fn trie_with_hal_2_3_5() -> MerklePatriciaForestry {
  mpt.from_root(
    #"2de0b0ad5346df469e08e403ae13dc9bf5606464564f03d5aa769049cce2257e",
  )
}

/// -------------------- Proofs
fn proof_hal_2() {
  [
    Branch {
      skip: 0,
      neighbors: #"e33395acb80e2e3c499164f66d49be19a963153395200ed91b4987bf00ad9b30b1b92e7b8791cac129502057c7a93a8c14b85721d99271fc4acfe174389d7b19e15819f2ff7fb626070830acbbb5a0f55a54004234aa1f264e1ae541d470ca16bae9322e5228e54dd627c755bb3eef54345d5253605e172ed800971f77dc5818",
    },
    Branch {
      skip: 0,
      neighbors: #"19bc3f449621ac5f4d629b77fdc7a43dcbf0cd1a12418ad1f2b9c993a5cb5e58b3a398df8baab66563230549d74a86cdcd4cc58bb461dd33b37183870b66e58b0eb923b0cbd24df54401d998531feead35a47a99f4deed205de4af81120f97610000000000000000000000000000000000000000000000000000000000000000",
    },
    Leaf {
      skip: 0,
      key: #"afe1251d03e6c4d5046f28652e347a524f3dd727fb7a5d2c4b6d0ec9a286903b",
      value: #"0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8",
    },
    Leaf {
      skip: 0,
      key: #"af389356a4b339be82f4b12c1314779e372c60c42b535651cad0be2397d71209",
      value: #"0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8",
    },
  ]
}

fn proof_hal_3() {
  [
    Branch {
      skip: 0,
      neighbors: #"cff673f2578eb45284df5ce3fc3a5986b882961c155596b6f0087a562ab5d5d0ea1b7cba04ec1be03044a93c75148e6c9f288d42a4392156600a1e4fe8f4c959934bce722f72d19bc45bf7009480e8dafc2e01b6c9b9f55957d2774f81f7658cf3abca078bd363a673fa84b6d7f8f615dfc3403be7bfc23fa50340dc8bee3f01",
    },
    Branch {
      skip: 0,
      neighbors: #"59916ec227a3f6f7d6eaaa3f8fed07cc4cbc33e4f49b00b09b0aebb3c1bf6d11477cc94667c37abf0d8cfa72b0f83727f2d2f783e964c492064377467db3781b0eb923b0cbd24df54401d998531feead35a47a99f4deed205de4af81120f9761def0ad876cbbe95007ebd46a69e22e880e6670ae88ddef529ca73ced981697d4",
    },
    Leaf {
      skip: 0,
      key: #"539d40e5275b55e1567c661f3eb1169bf583a2c198c3156ceba790cd6e746bcf",
      value: #"0e5751c026e543b2e8ab2eb06099daa1d1e5df47778f7787faab45cdf12fe3a8",
    },
  ]
}

fn proof_hal_5() {
  [
    Branch {
      skip: 0,
      neighbors: #"cff673f2578eb45284df5ce3fc3a5986b882961c155596b6f0087a562ab5d5d0ea1b7cba04ec1be03044a93c75148e6c9f288d42a4392156600a1e4fe8f4c959934bce722f72d19bc45bf7009480e8dafc2e01b6c9b9f55957d2774f81f7658ce665b55d1f9ad0fa10ef73fbd0ae8a448de72877b6680213429d4099ecd3f5ab",
    },
    Branch {
      skip: 0,
      neighbors: #"41e92c52331aa1e43e2a45e8f01655b6f83ee604fcdadca97142ba881c3a792485f5fc6abc72a409b4776a0ce7e9548397a99b4bb9aacbc9ec878dab9d394af80eb923b0cbd24df54401d998531feead35a47a99f4deed205de4af81120f97610000000000000000000000000000000000000000000000000000000000000000",
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

test can_mint_hal_2_with_mutation(
  mutation via fuzz_proof_mutation(proof_hal_2()),
) fail {
  let proof = proof_hal_2() |> mutate(mutation)
  let root = initial_trie()
  let new_root = root |> mpt.update("hal-2", proof, #"", mpt_minted_value)

  new_root == trie_with_hal_2()
}

test can_mint_hal_3_with_mutation(
  mutation via fuzz_proof_mutation(proof_hal_3()),
) fail {
  let proof = proof_hal_3() |> mutate(mutation)
  let root = trie_with_hal_2()
  let new_root = root |> mpt.update("hal-3", proof, #"", mpt_minted_value)

  new_root == trie_with_hal_2_3()
}

test can_mint_hal_5_with_mutation(
  mutation via fuzz_proof_mutation(proof_hal_5()),
) fail {
  let proof = proof_hal_5() |> mutate(mutation)
  let root = trie_with_hal_2_3()
  let new_root = root |> mpt.update("hal-5", proof, #"", mpt_minted_value)

  new_root == trie_with_hal_2_3_5()
}
