// NOTE:
// Configs are only used when make Settings Datum

import { NetworkName } from "@helios-lang/tx-utils";

import * as MAINNET_CONFIGS from "./mainnet.config.js";
import * as PREPROD_CONFIGS from "./preprod.config.js";
import * as PREVIEW_CONFIGS from "./preview.config.js";

const GET_CONFIGS = (network: NetworkName) => {
  if (network == "mainnet") return MAINNET_CONFIGS;
  if (network == "preprod") return PREPROD_CONFIGS;
  return PREVIEW_CONFIGS;
};

export { GET_CONFIGS };
