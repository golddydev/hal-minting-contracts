import { config } from "dotenv";
config({ path: `.env.${process.env.NODE_ENV || "development"}.local` });

export const {
  NODE_ENV = "",
  NETWORK = "",
  BLOCKFROST_API_KEY = "",
  KORA_USER_AGENT = "",
  HANDLE_ME_API_KEY = "",
} = process.env;
export const NETWORK_HOST =
  process.env.NETWORK?.toLocaleLowerCase() == "mainnet"
    ? ""
    : `${process.env.NETWORK?.toLowerCase()}.`;
export const HANDLE_API_ENDPOINT =
  process.env.HANDLE_API_ENDPOINT || `https://${NETWORK_HOST}api.handle.me`;

/// (100) Reference Token Prefix
export const PREFIX_100 = "000643b0";

/// (222) Non-Fungible Token Prefix
export const PREFIX_222 = "000de140";

// Contract names
export enum CONTRACT_NAME {
  MINT_PROXY_MINT = "mint_proxy.mint",
  MINT_WITHDRAW = "mint.withdraw",
  MINTING_DATA_SPEND = "minting_data.spend",
  ORDERS_SPEND_SPEND = "orders_spend.spend",
  REF_SPEND_PROXY_SPEND = "ref_spend_proxy.spend",
  REF_SPEND_WITHDRAW = "ref_spend.withdraw",
  ROYALTY_SPEND_SPEND = "royalty_spend.spend",
}

export const LEGACY_POLICY_ID =
  "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";

export const SETTINGS_HANDLE_NAME = "hal@handle_settings";
export const MINTING_DATA_HANDLE_NAME = "hal_root@handle_settings";

export const MPT_MINTED_VALUE = "minted";

// "Royalty" with asset name labe of 500
export const ROYALTY_ASSET_FULL_NAME = "001f4d70526f79616c7479";

export const ROYALTY_INCLUDED_KEY = "royalty_included";

export const ROYALTY_INCLUDED_HEX_KEY = "726f79616c74795f696e636c75646564";
