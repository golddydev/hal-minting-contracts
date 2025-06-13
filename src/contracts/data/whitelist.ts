import {
  decodeUplcData,
  expectIntData,
  expectListData,
  makeIntData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";
import { Err, Ok, Result } from "ts-res";

import { convertError } from "../../helpers/index.js";
import { WhitelistedItem } from "../types/whitelist.js";

const decodeWhitelistedItem = (value: Buffer): Result<WhitelistedItem, Error> => {
  try {
    const data = decodeUplcData(value);
    const listData = expectListData(data, "whitelisted_item must be List Data");
    const time_gap = expectIntData(
      listData.items[0],
      "time_gap must be Int Data"
    ).value;
    const amount = expectIntData(
      listData.items[1],
      "amount must be Int Data"
    ).value;
    return Ok([Number(time_gap), Number(amount)]);
  } catch (error) {
    return Err(
      new Error(`Failed to decode whitelisted item: ${convertError(error)}`)
    );
  }
};

const makeWhitelistedItemData = (
  whitelistedItem: WhitelistedItem
): UplcData => {
  const [time_gap, amount] = whitelistedItem;
  return makeListData([makeIntData(time_gap), makeIntData(amount)]);
};

export { decodeWhitelistedItem, makeWhitelistedItemData };
