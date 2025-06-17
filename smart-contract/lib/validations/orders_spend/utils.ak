use aiken/transaction/credential.{Address, VerificationKeyCredential}

pub fn is_refunded_output_address_valid(
  output_address: Address,
  owner_key_hash: ByteArray,
) -> Bool {
  let Address { payment_credential, .. } = output_address
  when payment_credential is {
    VerificationKeyCredential(vkh) -> vkh == owner_key_hash
    _ -> False
  }
}
