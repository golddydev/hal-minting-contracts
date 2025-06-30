use aiken/transaction/credential.{Address}

pub type OrderDatum {
  // the key hash of the wallet that placed the order that is used for cancelling the order.
  owner_key_hash: ByteArray,
  // address that the asset should be sent to.
  destination_address: Address,
  // amount of H.A.L. NFTs to mint
  amount: Int,
}

// only have
// destination_address
// and amount
pub type Order =
  (Address, Int)
