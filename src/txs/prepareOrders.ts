import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import { ShelleyAddress, TxInput } from "@helios-lang/ledger";
import { Err, Ok, Result } from "ts-res";

import {
  decodeOrderDatumData,
  SettingsV1,
  WhitelistedValue,
} from "../contracts/index.js";
import { mayFail } from "../helpers/index.js";
import { isOrderTxInputValid } from "./order.js";
import { AggregatedOrder } from "./types.js";
import {
  getAvailableWhitelistedValue,
  getWhitelistedKey,
  getWhitelistedValue,
  updateWhitelistedValue,
  useWhitelistedValueAsPossible,
} from "./whitelist.js";

interface PrepareOrdersParams {
  isMainnet: boolean;
  orderTxInputs: TxInput[];
  settingsV1: SettingsV1;
  whitelistDB: Trie;
  mintingTime: number;
  maxOrderAmountInOneTx: number;
}

interface PreparedOrdersResult {
  aggregatedOrdersList: Array<AggregatedOrder[]>;
  unprocessableOrderTxInputs: TxInput[];
  invalidOrderTxInputs: TxInput[];
}

const prepareOrders = async (
  params: PrepareOrdersParams
): Promise<Result<PreparedOrdersResult, Error>> => {
  const {
    isMainnet,
    orderTxInputs,
    settingsV1,
    whitelistDB,
    mintingTime,
    maxOrderAmountInOneTx,
  } = params;

  // first check order TxInput is valid or not
  const validOrderTxInputs: TxInput[] = [];
  const invalidOrderTxInputs: TxInput[] = [];
  for (const orderTxInput of orderTxInputs) {
    const isValidResult = isOrderTxInputValid({
      isMainnet,
      orderTxInput,
      settingsV1,
      maxOrderAmountInOneTx,
    });
    if (isValidResult.ok) {
      validOrderTxInputs.push(orderTxInput);
    } else {
      console.error(
        `Order UTxO ${orderTxInput.id.toString()} is invalid: ${
          isValidResult.error
        }`
      );
      invalidOrderTxInputs.push(orderTxInput);
    }
  }

  // aggregate orders
  const aggregatedResult = await aggregateOrderTxInputs({
    isMainnet,
    orderTxInputs: validOrderTxInputs,
    settingsV1,
    whitelistDB,
    mintingTime,
    maxOrderAmountInOneTx,
  });
  if (!aggregatedResult.ok) {
    return Err(
      new Error(`Failed to aggregate orders: ${aggregatedResult.error}`)
    );
  }
  const {
    aggregatedOrdersList,
    unprocessableOrderTxInputs,
    invalidOrderTxInputs: additionalInvalidOrderTxInputs,
  } = aggregatedResult.data;

  return Ok({
    aggregatedOrdersList,
    unprocessableOrderTxInputs,
    invalidOrderTxInputs: [
      ...invalidOrderTxInputs,
      ...additionalInvalidOrderTxInputs,
    ],
  });
};

interface AggregateOrderTxInputsParams {
  isMainnet: boolean;
  orderTxInputs: TxInput[];
  settingsV1: SettingsV1;
  whitelistDB: Trie;
  mintingTime: number;
  maxOrderAmountInOneTx: number;
}

/**
 * @description Aggregate Orders Tx Inputs
 * @param {AggregateOrderTxInputsParams} params
 * @returns {Result<AggregatedOrder[],  Error>} Result or Error
 */
const aggregateOrderTxInputs = async (
  params: AggregateOrderTxInputsParams
): Promise<
  Result<
    {
      aggregatedOrdersList: Array<AggregatedOrder[]>;
      unprocessableOrderTxInputs: TxInput[];
      invalidOrderTxInputs: TxInput[];
    },
    Error
  >
> => {
  const {
    isMainnet,
    orderTxInputs,
    settingsV1,
    whitelistDB,
    mintingTime,
    maxOrderAmountInOneTx,
  } = params;
  const aggregatedOrdersList: Array<AggregatedOrder[]> = [];
  const unprocessableOrderTxInputs: TxInput[] = [];
  const invalidOrderTxInputs: TxInput[] = [];

  const { hal_nft_price, minting_start_time } = settingsV1;
  const txTimeGap = minting_start_time - mintingTime;

  // NOTE:
  // sort orderUtxos by their lovelace
  // so we pick possible UTxO with least lovelace
  orderTxInputs.sort((a, b) => (a.value.lovelace > b.value.lovelace ? 1 : -1));

  // we keep WhitelistedValue by destination_address CBOR Hex to check
  const whitelistedValues: Record<string, WhitelistedValue | null> = {};
  const availableWhitelistedValues: Record<string, WhitelistedValue | null> =
    {};

  // this is processing state
  let aggregatingOrders: AggregatedOrder[] = [];
  let aggregatingTotalAmount: number = 0;

  for (const orderTxInput of orderTxInputs) {
    const decodedResult = mayFail(() =>
      decodeOrderDatumData(orderTxInput.datum, isMainnet)
    );
    if (!decodedResult.ok) {
      return Err(
        new Error(
          `Invalid Order Datum while aggregating orders: ${decodedResult.error}`
        )
      );
    }
    const { destination_address, amount } = decodedResult.data;

    // get whitelisted value if destination_address is not in whitelistedValues
    const destinationAddressKey =
      getWhitelistedKey(destination_address).toString("hex");
    if (!(destinationAddressKey in whitelistedValues)) {
      const value = await getWhitelistedValue(whitelistDB, destination_address);
      // get available ones by minting time
      whitelistedValues[destinationAddressKey] = value;
      availableWhitelistedValues[destinationAddressKey] = value
        ? getAvailableWhitelistedValue(value, txTimeGap)
        : null;
    }

    // check with whitelisted value (for discounted price)
    const availableWhitelistedValue =
      availableWhitelistedValues[destinationAddressKey];
    const allWhitelistedValue = whitelistedValues[destinationAddressKey];

    // check orderInput is valid to mint or not
    const canMintResult = checkCanMintOrder(
      orderTxInput.id.toString(),
      destination_address.toBech32(),
      amount,
      orderTxInput.value.lovelace,
      hal_nft_price,
      txTimeGap,
      availableWhitelistedValue,
      allWhitelistedValue
    );

    if (canMintResult.status === "valid") {
      // update whitelisted value
      whitelistedValues[destinationAddressKey] =
        canMintResult.newWhitelistedValue;
      // put it to aggregatingOrders or aggregatedOrdersList
      if (aggregatingTotalAmount + amount > maxOrderAmountInOneTx) {
        aggregatedOrdersList.push(aggregatingOrders);
        aggregatingOrders = [];
        aggregatingTotalAmount = 0;
      }
      aggregatingOrders = addOrderToAggregatedOrders(
        aggregatingOrders,
        orderTxInput,
        destination_address,
        amount,
        canMintResult.needWhitelistProof
      );
      aggregatingTotalAmount += amount;
    } else if (canMintResult.status === "unprocessable") {
      unprocessableOrderTxInputs.push(orderTxInput);
    } else if (canMintResult.status === "invalid") {
      invalidOrderTxInputs.push(orderTxInput);
    }
  }

  if (aggregatingOrders.length > 0) {
    aggregatedOrdersList.push(aggregatingOrders);
  }

  return Ok({
    aggregatedOrdersList,
    unprocessableOrderTxInputs,
    invalidOrderTxInputs,
  });
};

const addOrderToAggregatedOrders = (
  aggregatedOrders: AggregatedOrder[],
  orderTxInput: TxInput,
  address: ShelleyAddress,
  amount: number,
  needWhitelistProof: boolean
): AggregatedOrder[] => {
  const newAggregatedOrders: AggregatedOrder[] = [];

  let added: boolean = false;
  for (const aggregatedOrder of aggregatedOrders) {
    const {
      destinationAddress,
      amount: aggregatedAmount,
      orderTxInputs,
      needWhitelistProof: originalNeedWhitelistProof,
    } = aggregatedOrder;
    if (address.toHex() === destinationAddress.toHex()) {
      added = true;
      newAggregatedOrders.push({
        destinationAddress,
        amount: aggregatedAmount + amount,
        orderTxInputs: [...orderTxInputs, orderTxInput],
        needWhitelistProof: originalNeedWhitelistProof || needWhitelistProof,
      });
    } else {
      newAggregatedOrders.push(aggregatedOrder);
    }
  }
  if (!added) {
    newAggregatedOrders.push({
      destinationAddress: address,
      amount,
      orderTxInputs: [orderTxInput],
      needWhitelistProof,
    });
  }

  return newAggregatedOrders;
};

const checkCanMintOrder = (
  orderTxInputId: string,
  destinationAddress: string,
  amount: number,
  lovelace: bigint,
  halNftPrice: bigint,
  txTimeGap: number,
  whitelistedValue: WhitelistedValue | null,
  allWhitelistedValue: WhitelistedValue | null
):
  | { status: "invalid" | "unprocessable" }
  | {
      status: "valid";
      needWhitelistProof: boolean;
      newWhitelistedValue: WhitelistedValue | null;
    } => {
  if (!whitelistedValue || whitelistedValue.length == 0) {
    // if no whitelisted value or whitelisted value is empty
    // txTimeGap must be less than 0
    // and there is no discount
    const expectedLovelace = halNftPrice * BigInt(amount);
    if (txTimeGap < 0) {
      if (lovelace >= expectedLovelace) {
        return {
          status: "valid",
          needWhitelistProof: false,
          newWhitelistedValue: whitelistedValue,
        };
      } else {
        console.error(
          `Order UTxO ${orderTxInputId} failed to be processed. Need ${expectedLovelace} but has only ${lovelace}`
        );
        return {
          status: "invalid",
        };
      }
    } else {
      console.error(
        `Order UTxO ${orderTxInputId} failed to be processed as Whitelisted enough. ${destinationAddress} not whitelisted enough. Wait till minting_start_time`,
        {
          whitelistedValue,
          txTimeGap,
          amount,
          expectedLovelace,
          lovelace,
        }
      );
      return {
        status: "unprocessable",
      };
    }
  } else {
    // then use whitelisted value based on minting time
    const {
      newWhitelistedValue,
      remainingOrderedAmount,
      spentLovelaceForWhitelisted,
    } = updateWhitelistedValue(whitelistedValue, amount, txTimeGap);

    // we also check in case if user can use all of his current whitelisted value
    // if he has at more than possibleExpectedLovelace
    if (allWhitelistedValue) {
      const useWhitelistedValueAsPossibleResult = useWhitelistedValueAsPossible(
        allWhitelistedValue,
        amount
      );
      const possibleExpectedLovelace =
        useWhitelistedValueAsPossibleResult.spentLovelaceForWhitelisted +
        halNftPrice *
          BigInt(useWhitelistedValueAsPossibleResult.remainingOrderedAmount);
      if (lovelace < possibleExpectedLovelace) {
        console.error(
          `Order UTxO ${orderTxInputId} failed to be processed even as whitelisted. Need ${possibleExpectedLovelace} but has only ${lovelace}`,
          {
            allWhitelistedValue,
            amount,
            possibleExpectedLovelace,
            lovelace,
          }
        );
        return {
          status: "invalid",
        };
      }
    }

    if (remainingOrderedAmount > 0) {
      // can not mint all as whitelisted
      // must be after minting_start_time
      if (txTimeGap < 0) {
        const expectedLovelace =
          halNftPrice * BigInt(remainingOrderedAmount) +
          spentLovelaceForWhitelisted;
        if (lovelace >= expectedLovelace) {
          return {
            status: "valid",
            needWhitelistProof: true,
            newWhitelistedValue,
          };
        } else {
          console.error(
            `Order UTxO ${orderTxInputId} failed to be processed SOME as whitelisted. Need ${expectedLovelace} but has only ${lovelace}`,
            {
              whitelistedValue,
              txTimeGap,
              amount,
              expectedLovelace,
              lovelace,
            }
          );
          return {
            status: "unprocessable",
          };
        }
      } else {
        console.error(
          `Order UTxO ${orderTxInputId} couldn't be minted ALL as whitelisted. So wait till minting_start_time`,
          {
            whitelistedValue,
            txTimeGap,
            amount,
            remainingOrderedAmount,
          }
        );
        return {
          status: "unprocessable",
        };
      }
    } else {
      // this means we can mint ALL as whitelisted
      // so only check if there is enough lovelace
      const expectedLovelace = spentLovelaceForWhitelisted;
      if (lovelace >= expectedLovelace) {
        return {
          status: "valid",
          needWhitelistProof: true,
          newWhitelistedValue,
        };
      } else {
        console.error(
          `Order UTxO ${orderTxInputId} failed to be processed ALL as whitelisted. Need ${expectedLovelace} but has only ${lovelace}`,
          {
            whitelistedValue,
            txTimeGap,
            amount,
            expectedLovelace,
            lovelace,
          }
        );
        return {
          status: "unprocessable",
        };
      }
    }
  }
};

interface GetMintingCostParams {
  destinationAddress: ShelleyAddress;
  amount: number;
  initialWhitelistDB: Trie;
  usedCount: number;
  halNftPrice: bigint;
}

const getMintingCost = async (
  params: GetMintingCostParams
): Promise<bigint> => {
  const {
    destinationAddress,
    amount,
    initialWhitelistDB,
    usedCount,
    halNftPrice,
  } = params;

  const whitelistedValue = await getWhitelistedValue(
    initialWhitelistDB,
    destinationAddress
  );
  if (whitelistedValue) {
    const {
      newWhitelistedValue: usedWhitelistedValue,
      remainingOrderedAmount: remainingAmountAfterUsed,
    } = useWhitelistedValueAsPossible(whitelistedValue, usedCount);
    if (remainingAmountAfterUsed > 0) {
      return halNftPrice * BigInt(amount);
    } else {
      const { remainingOrderedAmount, spentLovelaceForWhitelisted } =
        useWhitelistedValueAsPossible(usedWhitelistedValue, amount);
      return (
        spentLovelaceForWhitelisted +
        halNftPrice * BigInt(remainingOrderedAmount)
      );
    }
  } else {
    return halNftPrice * BigInt(amount);
  }
};

export type {
  AggregateOrderTxInputsParams,
  GetMintingCostParams,
  PrepareOrdersParams,
};
export { aggregateOrderTxInputs, getMintingCost, prepareOrders };
