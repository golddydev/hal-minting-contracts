// whitelisted item
// time_gap: Gap between the time of minting and the time of whitelisting in milliseconds
// amount: Amount of H.A.L. NFTs that address can mint as whitelisted
// price: Discounted price of H.A.L. NFTs that address can mint as whitelisted
pub type WhitelistedItem {
  time_gap: Int,
  amount: Int,
  price: Int,
}

// whitelisted value
// using corresponding whitelisted key (destination address)
pub type WhitelistedValue =
  List<WhitelistedItem>
