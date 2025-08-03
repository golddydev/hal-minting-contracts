use aiken/cbor.{serialise}
use aiken/transaction/credential.{Address, Inline}

// whitelisted item
// time_gap: Gap between the time of minting and the time of whitelisting in milliseconds
// amount: Amount of H.A.L. NFTs that address can mint as whitelisted
pub type WhitelistedItem {
  time_gap: Int,
  amount: Int,
}

// whitelisted value
// using corresponding whitelisted key (destination address)
pub type WhitelistedValue =
  List<WhitelistedItem>

/// This function returns the key used in whitelisted MPT from the destination address
/// if address has stake credential, that must be inline stake credential and it will return the stake credential
/// if address does not have stake credential, it will return the payment credential
///
pub fn get_whitelisted_key_from_addres(
  destination_address: Address,
) -> ByteArray {
  let Address { payment_credential, stake_credential: stake_credential_opt } =
    destination_address
  when stake_credential_opt is {
    Some(stake_credential) ->
      when stake_credential is {
        Inline(inline_stake_credential) -> serialise(inline_stake_credential)
        _ -> fail @"stake credential must be inline"
      }
    None -> serialise(payment_credential)
  }
}
