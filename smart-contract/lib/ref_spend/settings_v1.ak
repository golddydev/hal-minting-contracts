use aiken/transaction/value.{PolicyId}
use common/hashes.{VerificationKeyHash}

pub type RefSpendSettingsV1 {
  policy_id: PolicyId,
  // ref_spend admin is used to authorize updating CIP68 Datum
  // this is referred to as `ref_spend_admin` in `ref_spend` withdrawal validator
  ref_spend_admin: VerificationKeyHash,
}
