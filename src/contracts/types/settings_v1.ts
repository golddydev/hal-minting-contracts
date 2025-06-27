import { Address } from "@helios-lang/ledger";

interface SettingsV1 {
  policy_id: string;
  // who can mint HAL NFTs
  allowed_minter: string;
  // hal nft's price
  hal_nft_price: bigint;
  // address to collect HAL NFT's cost
  payment_address: Address;
  // ref_spend_proxy Spending validator hash
  // ref asset is sent to this script
  ref_spend_proxy_script_hash: string;
  // ref_spend withdrawal validator hash
  // this is ref_spend_proxy governor
  ref_spend_governor: string;
  // user makes an order (as UTxO) to this script
  orders_spend_script_hash: string;
  // royalty spend script hash
  // Royalty NFT is sent to this script
  royalty_spend_script_hash: string;
  // minting data script is used to check
  // all minting handles logic (for both new and legacy)
  // minting_data_asset is locked inside that script
  minting_data_script_hash: string;
  // Maximum Amount of H.A.L. NFTs that can be ordered at once
  max_order_amount: number;
  // when the minting (for everyone) starts
  minting_start_time: number;
}

export type { SettingsV1 };
