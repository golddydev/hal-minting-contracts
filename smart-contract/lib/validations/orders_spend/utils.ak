use aiken/builtin.{choose_data, un_b_data, un_constr_data}
use aiken/bytearray
use aiken/list
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

// This function checks if the datum is a valid OrderDatum
// and returns owner_key_hash if datum is valid
//
// Checks:
// - must be a constructor
// - must have 3 fields
// - first field must be a bytearray
// - second field must be a constructor
// - third field must be an int
// - owner_key_hash must be 28 bytes
//
pub fn get_owner_key_hash_from_datum(datum: Data) -> Option<ByteArray> {
  let is_constr = is_constructor(datum)

  when is_constr is {
    True -> {
      let Pair(index, fields) = un_constr_data(datum)
      let is_constr_valid = index == 0 && list.length(fields) == 3
      when is_constr_valid is {
        True -> {
          expect [owner_key_hash_data, destination_address_data, amount_data] =
            fields
          let is_owner_key_hash_bytearray = is_bytearray(owner_key_hash_data)
          let is_destination_address_constr =
            is_constructor(destination_address_data)
          let is_amount_int = is_int(amount_data)
          let owner_key_hash = un_b_data(owner_key_hash_data)
          let is_owner_key_hash_valid = bytearray.length(owner_key_hash) == 28

          let is_datum_valid = and {
              is_owner_key_hash_bytearray,
              is_destination_address_constr,
              is_amount_int,
              is_owner_key_hash_valid,
            }

          when is_datum_valid is {
            True -> Some(owner_key_hash)
            False -> None
          }
        }
        False -> None
      }
    }
    False -> None
  }
}

fn is_constructor(data: Data) -> Bool {
  let is_constr = choose_data(data, True, False, False, False, False)
  is_constr
}

fn is_bytearray(data: Data) -> Bool {
  let is_bytes = choose_data(data, False, False, False, False, True)
  is_bytes
}

fn is_int(data: Data) -> Bool {
  let is_num = choose_data(data, False, False, False, True, False)
  is_num
}
