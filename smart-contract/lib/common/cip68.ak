/// (100) Reference Token Prefix
pub const prefix_100: ByteArray = #"000643b0"

/// (222) Non-Fungible Token Prefix
pub const prefix_222: ByteArray = #"000de140"

pub type CIP68Datum {
  metadata: Pairs<Data, Data>,
  version: Int,
  extra: Data,
}
