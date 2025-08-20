// whitelisted item
// time_gap: Gap between the time of minting and the time of whitelisting in milliseconds
// amount: Amount of H.A.L. NFTs that address can mint as whitelisted
// price: Discounted price of H.A.L. NFTs that address can mint as whitelisted
interface WhitelistedItem {
  time_gap: number;
  amount: number;
  price: bigint;
}

// whitelisted value
// using corresponding whitelisted key (destination address)
type WhitelistedValue = Array<WhitelistedItem>;

export { WhitelistedItem, WhitelistedValue };
