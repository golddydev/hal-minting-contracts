import { Err, Ok, Result } from "ts-res";

import { WhitelistedValue } from "../contracts/index.js";

type UpdateWhitelistedValueResult = {
  newWhitelistedValue: WhitelistedValue;
  newOrderedAmount: number;
};

const updateWhitelistedValue = (
  whitelistedValue: WhitelistedValue,
  orderedAmount: number,
  transactionTimeGap: number
): Result<WhitelistedValue, Error> => {
  const result = whitelistedValue.reduce(
    (acc, cur) => {
      if (cur.amount <= 0) return acc;

      const { newWhitelistedValue, newOrderedAmount } = acc;
      if (transactionTimeGap > cur.time_gap) {
        return {
          newWhitelistedValue: [...newWhitelistedValue, cur],
          newOrderedAmount: newOrderedAmount,
        };
      }
      const availableAmount = Math.min(cur.amount, newOrderedAmount);
      const updatedOrderedAmount = newOrderedAmount - availableAmount;
      const newAmount = cur.amount - availableAmount;

      const updatedWhitelistedValue: WhitelistedValue =
        newAmount <= 0
          ? newWhitelistedValue
          : [
              ...newWhitelistedValue,
              { time_gap: cur.time_gap, amount: newAmount },
            ];

      return {
        newWhitelistedValue: updatedWhitelistedValue,
        newOrderedAmount: updatedOrderedAmount,
      } as UpdateWhitelistedValueResult;
    },
    {
      newWhitelistedValue: [],
      newOrderedAmount: orderedAmount,
    } as UpdateWhitelistedValueResult
  );

  const { newWhitelistedValue, newOrderedAmount } = result;
  if (newOrderedAmount > 0) {
    return Err(new Error("Whitelisted Amount is not enough"));
  }

  return Ok(newWhitelistedValue);
};

export { updateWhitelistedValue };
