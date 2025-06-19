import { Address } from "@helios-lang/ledger";

interface SettingsV1 {
  policy_id: string;
  // who can mint HAL NFTs
  allowed_minter: string;
  // hal nft's price
  hal_nft_price: bigint;
  // address to collect HAL NFT's cost
  payment_address: Address;
  // ref_spend Spending validator address
  // ref asset is sent to this address
  ref_spend_script_address: Address;
  // user makes an order (as UTxO) to this address
  orders_spend_script_address: Address;
  // royalty spend script address
  royalty_spend_script_address: Address;
  // minting data script is used to check
  // all minting handles logic (for both new and legacy)
  // minting_data_asset is locked inside that script
  minting_data_script_hash: string;
  // required when spending H.A.L. reference asset
  // from Ref Spend Spending validator
  ref_spend_admin: string;
  // Maximum Amount of H.A.L. NFTs that can be ordered at once
  max_order_amount: number;
  // POSIX time when minting starts for everyone
  minting_start_time: number;
}

export type { SettingsV1 };
