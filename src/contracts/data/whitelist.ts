import {
  decodeUplcData,
  expectConstrData,
  expectIntData,
  expectListData,
  makeConstrData,
  makeIntData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";
import { Err, Ok, Result } from "ts-res";

import { convertError } from "../../helpers/index.js";
import { WhitelistedItem, WhitelistedValue } from "../types/whitelist.js";

const decodeWhitelistedValueFromCBOR = (
  value: Buffer
): Result<WhitelistedValue, Error> => {
  try {
    const data = decodeUplcData(value);
    const listData = expectListData(
      data,
      "whitelisted_value must be List Data"
    );

    const whitelistedValue = listData.items.map(decodeWhitelistedItem);
    return Ok(whitelistedValue);
  } catch (error) {
    return Err(
      new Error(`Failed to decode whitelisted item: ${convertError(error)}`)
    );
  }
};

const decodeWhitelistedItem = (data: UplcData): WhitelistedItem => {
  const constrData = expectConstrData(data, 0, 2);

  const time_gap = Number(
    expectIntData(constrData.fields[0], "time_gap must be Int data").value
  );
  const amount = Number(
    expectIntData(constrData.fields[1], "amount must be Int data").value
  );

  return {
    time_gap,
    amount,
  };
};

const makeWhitelistedValueData = (
  whitelistedValue: WhitelistedValue
): UplcData => {
  return makeListData(whitelistedValue.map(makeWhitelistedItemData));
};

const makeWhitelistedItemData = (
  whitelistedItem: WhitelistedItem
): UplcData => {
  const { time_gap, amount } = whitelistedItem;
  return makeConstrData(0, [makeIntData(time_gap), makeIntData(amount)]);
};

export {
  decodeWhitelistedValueFromCBOR,
  makeWhitelistedItemData,
  makeWhitelistedValueData,
};
