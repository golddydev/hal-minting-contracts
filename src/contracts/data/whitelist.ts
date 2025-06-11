import {
  decodeUplcData,
  expectIntData,
  expectListData,
} from "@helios-lang/uplc";
import { Err, Ok, Result } from "ts-res";

import { convertError } from "../../helpers/index.js";
import { WhitelistedItem } from "../types/whitelist.js";

const decodeWhitelistItem = (value: Buffer): Result<WhitelistedItem, Error> => {
  try {
    const data = decodeUplcData(value);
    const listData = expectListData(data, "whitelisted_item must be List Data");
    const time = expectIntData(
      listData.items[0],
      "time must be Int Data"
    ).value;
    const amount = expectIntData(
      listData.items[1],
      "amount must be Int Data"
    ).value;
    return Ok([Number(time), Number(amount)]);
  } catch (error) {
    return Err(
      new Error(`Failed to decode whitelisted item: ${convertError(error)}`)
    );
  }
};

export { decodeWhitelistItem };
