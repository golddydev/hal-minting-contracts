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

// H.A.L NFT price
export const HAL_NFT_PRICE = 180_000_000n;

// Contract names
export const CONTRACT_NAMES = [
  "mint_proxy.mint",
  "mint_v1.withdraw",
  "minting_data.spend",
  "orders_mint.mint",
  "orders_spend.spend",
];

export const LEGACY_POLICY_ID =
  "f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a";

export const SETTINGS_HANDLE_NAME = "settings@hal_mint";
export const MINTING_DATA_HANDLE_NAME = "root@hal_mint";

export const MPT_MINTED_VALUE = "minted";

export const ORDER_ASSET_UTF8_NAME = "HAL_ORDER";
export const ORDER_ASSET_HEX_NAME = "48414c5f4f52444552";
