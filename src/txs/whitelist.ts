import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import { ShelleyAddress } from "@helios-lang/ledger";

import {
  decodeWhitelistedValueFromCBOR,
  WhitelistedValue,
} from "../contracts/index.js";

const getWhitelistedValue = async (
  whitelistDB: Trie,
  destinationAddress: ShelleyAddress
): Promise<WhitelistedValue | null> => {
  const whitelistedKey = getWhitelistedKey(destinationAddress);

  try {
    const whitelistedValueCbor = await whitelistDB.get(whitelistedKey);
    if (!whitelistedValueCbor) {
      return null;
    }

    const whitelistedValueResult =
      decodeWhitelistedValueFromCBOR(whitelistedValueCbor);
    if (!whitelistedValueResult.ok) {
      console.error(
        `Address ${destinationAddress.toBech32()} has invalid whitelisted item data in Trie: ${
          whitelistedValueResult.error
        }`
      );
      return null;
    }
    const whitelistedValue = whitelistedValueResult.data;
    return whitelistedValue;
  } catch (error) {
    console.error(
      `Failed to get whitelisted value for Address ${destinationAddress.toBech32()} in Trie`,
      error
    );
    return null;
  }
};

type UpdateWhitelistedValueResult = {
  newWhitelistedValue: WhitelistedValue;
  remainingOrderedAmount: number;
  spentLovelaceForWhitelisted: bigint;
};

// This function updates whitelisted_value
// against the ordered_amount
//
// Spend whitelisted_item's amount (together reducing ordered_amount) if tx_time_gap
// is available with whitelisted_item's time_gap
// and collect whitelisted_item's price to spent_lovelace_for_whitelisted
//
// Returns: (new_whitelisted_value, remaining_ordered_amount, spent_lovelace_for_whitelisted)
//
const updateWhitelistedValue = (
  whitelistedValue: WhitelistedValue,
  orderedAmount: number,
  transactionTimeGap: number
): UpdateWhitelistedValueResult => {
  const result = whitelistedValue.reduce(
    (acc, cur) => {
      if (cur.amount <= 0) return acc;

      const {
        newWhitelistedValue,
        remainingOrderedAmount,
        spentLovelaceForWhitelisted,
      } = acc;
      if (transactionTimeGap > cur.time_gap) {
        return {
          newWhitelistedValue: [...newWhitelistedValue, cur],
          remainingOrderedAmount,
          spentLovelaceForWhitelisted,
        };
      }
      const availableAmount = Math.min(cur.amount, remainingOrderedAmount);
      const newRemainingOrderedAmount =
        remainingOrderedAmount - availableAmount;
      const newAmount = cur.amount - availableAmount;
      const newSpentLovelaceForWhitelisted =
        spentLovelaceForWhitelisted + cur.price * BigInt(availableAmount);

      const updatedWhitelistedValue: WhitelistedValue =
        newAmount <= 0
          ? newWhitelistedValue
          : [...newWhitelistedValue, { ...cur, amount: newAmount }];

      return {
        newWhitelistedValue: updatedWhitelistedValue,
        remainingOrderedAmount: newRemainingOrderedAmount,
        spentLovelaceForWhitelisted: newSpentLovelaceForWhitelisted,
      } as UpdateWhitelistedValueResult;
    },
    {
      newWhitelistedValue: [],
      remainingOrderedAmount: orderedAmount,
      spentLovelaceForWhitelisted: 0n,
    } as UpdateWhitelistedValueResult
  );

  return result;
};

interface UseWhitelistedValueAsPossibleResult {
  newWhitelistedValue: WhitelistedValue;
  remainingOrderedAmount: number;
  spentLovelaceForWhitelisted: bigint;
}

const useWhitelistedValueAsPossible = (
  whitelistedValue: WhitelistedValue,
  orderedAmount: number
): UseWhitelistedValueAsPossibleResult => {
  const result = whitelistedValue.reduce(
    (acc, cur) => {
      if (cur.amount <= 0) return acc;

      const {
        newWhitelistedValue,
        remainingOrderedAmount,
        spentLovelaceForWhitelisted,
      } = acc;
      const availableAmount = Math.min(cur.amount, remainingOrderedAmount);
      const newRemainingOrderedAmount =
        remainingOrderedAmount - availableAmount;
      const newAmount = cur.amount - availableAmount;
      const newSpentLovelaceForWhitelisted =
        spentLovelaceForWhitelisted + cur.price * BigInt(availableAmount);

      const updatedWhitelistedValue: WhitelistedValue =
        newAmount <= 0
          ? newWhitelistedValue
          : [...newWhitelistedValue, { ...cur, amount: newAmount }];

      return {
        newWhitelistedValue: updatedWhitelistedValue,
        remainingOrderedAmount: newRemainingOrderedAmount,
        spentLovelaceForWhitelisted: newSpentLovelaceForWhitelisted,
      } as UseWhitelistedValueAsPossibleResult;
    },
    {
      newWhitelistedValue: [],
      remainingOrderedAmount: orderedAmount,
      spentLovelaceForWhitelisted: 0n,
    } as UseWhitelistedValueAsPossibleResult
  );

  return result;
};

const getAvailableWhitelistedValue = (
  whitelistedValue: WhitelistedValue,
  txTimeGap: number
): WhitelistedValue => {
  return whitelistedValue.filter(
    (item) => item.amount > 0 && item.time_gap >= txTimeGap
  );
};

const getWhitelistedKey = (address: ShelleyAddress): Buffer => {
  return Buffer.from(address.toUplcData().toCbor());
};

export {
  getAvailableWhitelistedValue,
  getWhitelistedKey,
  getWhitelistedValue,
  updateWhitelistedValue,
  useWhitelistedValueAsPossible,
};
