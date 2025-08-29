import {
  Address,
  makeAddress,
  makeInlineTxOutputDatum,
  makePubKeyHash,
  makeValidatorHash,
  makeValue,
  ShelleyAddress,
  TxInput,
} from "@helios-lang/ledger";
import { CardanoClient, makeTxBuilder, TxBuilder } from "@helios-lang/tx-utils";
import { ScriptDetails } from "@koralabs/kora-labs-common";
import { Err, Ok, Result } from "ts-res";

import { MAX_ORDER_UTXOS_IN_ONE_TX } from "../constants/index.js";
import {
  buildOrderDatumData,
  buildOrdersSpendCancelOrderRedeemer,
  buildOrdersSpendRefundOrderRedeemer,
  decodeOrderDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  OrderDatum,
  Settings,
  SettingsV1,
} from "../contracts/index.js";
import { mayFail, mayFailAsync } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";
import { Order } from "./types.js";

interface RequestParams {
  isMainnet: boolean;
  orders: Order[];
  settings: Settings;
  maxOrderAmountInOneTx: number;
}

/**
 * @description Request asset to be minted
 * @param {RequestParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const request = async (
  params: RequestParams
): Promise<Result<TxBuilder, Error>> => {
  const { isMainnet, orders, settings, maxOrderAmountInOneTx } = params;

  for (const { destinationAddress, amount } of orders) {
    if (destinationAddress.spendingCredential.kind == "ValidatorHash")
      return Err(new Error("Must be Base address"));

    if (amount <= 0n) {
      return Err(new Error("Amount must be greater than 0"));
    }

    if (amount > maxOrderAmountInOneTx) {
      return Err(
        new Error(
          `Order amount must be less than or equal to ${maxOrderAmountInOneTx}`
        )
      );
    }
  }

  if (orders.length > MAX_ORDER_UTXOS_IN_ONE_TX) {
    return Err(
      new Error(
        `Can request Orders less than or equal to ${MAX_ORDER_UTXOS_IN_ONE_TX} in one transaction`
      )
    );
  }

  // decode settings
  const { data: settingsV1Data } = settings;
  const settingsV1Result = mayFail(() =>
    decodeSettingsV1Data(settingsV1Data, isMainnet)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const { orders_spend_script_hash } = settingsV1Result.data;

  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(orders_spend_script_hash)
  );

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- pay order value to order spend script address for each order
  for (const { destinationAddress, amount, cost } of orders) {
    const orderDatum: OrderDatum = {
      owner_key_hash: destinationAddress.spendingCredential.toHex(),
      destination_address: destinationAddress,
      amount,
    };
    const orderValue = makeValue(cost);

    txBuilder.payUnsafe(
      ordersSpendScriptAddress,
      orderValue,
      makeInlineTxOutputDatum(buildOrderDatumData(orderDatum))
    );
  }

  return Ok(txBuilder);
};

interface CancelParams {
  isMainnet: boolean;
  address: Address;
  orderTxInput: TxInput;
  deployedScripts: DeployedScripts;
}

/**
 * @description Request handle to be minted
 * @param {CancelParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const cancel = async (
  params: CancelParams
): Promise<Result<TxBuilder, Error>> => {
  const { isMainnet, address, orderTxInput, deployedScripts } = params;
  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));
  if (address.spendingCredential.kind == "ValidatorHash")
    return Err(new Error("Must be Base address"));

  const { ordersSpendScriptTxInput, ordersSpendScriptDetails } =
    deployedScripts;

  // check if order tx input is from ordersSpendScriptAddress
  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );
  if (!orderTxInput.address.isEqual(ordersSpendScriptAddress)) {
    return Err(
      new Error("Order Tx Input must be from Orders Spend Script Address")
    );
  }

  // check all order tx inputs must have same owner_key_hash in datum
  const orderDatumResult = mayFail(() =>
    decodeOrderDatumData(orderTxInput.datum, isMainnet)
  );
  if (!orderDatumResult.ok) {
    return Err(
      new Error(`Order Tx Input datum is invalid: ${orderDatumResult.error}`)
    );
  }
  const { owner_key_hash } = orderDatumResult.data;

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach orders spend and mint scripts
  txBuilder.refer(ordersSpendScriptTxInput);

  // <-- spend order tx input
  txBuilder.spendUnsafe(orderTxInput, buildOrdersSpendCancelOrderRedeemer());

  // <-- add signer
  txBuilder.addSigners(makePubKeyHash(owner_key_hash));

  return Ok(txBuilder);
};
interface RefundParams {
  isMainnet: boolean;
  orderTxInput: TxInput;
  refundingAddress: ShelleyAddress;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
}

/**
 * @description Refund Order UTxO
 * @param {RefundParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const refund = async (
  params: RefundParams
): Promise<Result<TxBuilder, Error>> => {
  const {
    isMainnet,
    orderTxInput,
    refundingAddress,
    deployedScripts,
    settingsAssetTxInput,
  } = params;

  const { ordersSpendScriptTxInput, ordersSpendScriptDetails } =
    deployedScripts;

  // decode settings
  const settingsResult = mayFail(() =>
    decodeSettingsDatum(settingsAssetTxInput.datum)
  );
  if (!settingsResult.ok) {
    return Err(new Error(`Failed to decode settings: ${settingsResult.error}`));
  }
  const { data: settingsV1Data } = settingsResult.data;
  const settingsV1Result = mayFail(() =>
    decodeSettingsV1Data(settingsV1Data, isMainnet)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const { allowed_minter } = settingsV1Result.data;

  // check if order tx input is from ordersSpendScriptAddress
  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );
  if (!orderTxInput.address.isEqual(ordersSpendScriptAddress)) {
    return Err(
      new Error("Order Tx Input must be from Orders Spend Script Address")
    );
  }

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach settings asset as reference input
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach orders spend and mint scripts
  txBuilder.refer(ordersSpendScriptTxInput);

  // <-- spend order tx input
  txBuilder.spendUnsafe(orderTxInput, buildOrdersSpendRefundOrderRedeemer());
  const decodedOrderDatum = mayFail(() =>
    decodeOrderDatumData(orderTxInput.datum, isMainnet)
  );
  if (decodedOrderDatum.ok) {
    // check refundingAddress has owner_key_hash as payment cred
    const ownerKeyHash = decodedOrderDatum.data.owner_key_hash;
    if (
      refundingAddress.spendingCredential.toHex().toLowerCase() !==
      ownerKeyHash.toLowerCase()
    ) {
      return Err(
        new Error(
          `Order Tx Input ${orderTxInput.id.toString()} must be refunded to "${ownerKeyHash}" payment credential`
        )
      );
    }
  }

  // <-- add signer (allowed_minter)
  txBuilder.addSigners(makePubKeyHash(allowed_minter));

  return Ok(txBuilder);
};
interface FetchOrderTxInputsParams {
  cardanoClient: CardanoClient;
  ordersSpendScriptDetails: ScriptDetails;
}

/**
 * @description Fetch Order UTxOs
 * @param {FetchOrderTxInputsParams} params
 * @returns {Promise<Result<TxInput[], Error>>} Transaction Result
 */
const fetchOrderTxInputs = async (
  params: FetchOrderTxInputsParams
): Promise<Result<TxInput[], Error>> => {
  const { cardanoClient, ordersSpendScriptDetails } = params;
  const isMainnet = cardanoClient.isMainnet();

  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );

  // fetch order utxos
  const orderUtxosResult = await mayFailAsync(() =>
    cardanoClient.getUtxos(ordersSpendScriptAddress)
  ).complete();
  if (!orderUtxosResult.ok)
    return Err(
      new Error(`Failed to fetch order UTxOs: ${orderUtxosResult.error}`)
    );

  return Ok(orderUtxosResult.data);
};

interface IsOrderTxInputValidParams {
  isMainnet: boolean;
  orderTxInput: TxInput;
  settingsV1: SettingsV1;
  maxOrderAmountInOneTx: number;
}

/**
 * @description Check if TxInput is valid order UTxO
 * Check if Order UTxO is from Orders Spend Script Address
 * Check if Order UTxO's datum is valid
 * @param {IsOrderTxInputValidParams} params
 * @returns {boolean} True if valid order UTxO, false otherwise
 */
const isOrderTxInputValid = (
  params: IsOrderTxInputValidParams
): Result<true, Error> => {
  const { isMainnet, orderTxInput, settingsV1, maxOrderAmountInOneTx } = params;
  const { orders_spend_script_hash } = settingsV1;

  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(orders_spend_script_hash)
  );

  // check if address matches
  if (!orderTxInput.address.isEqual(ordersSpendScriptAddress)) {
    return Err(
      new Error("Order TxInput must be from Orders Spend Script Address")
    );
  }

  // check if datum is valid
  const decodedResult = mayFail(() =>
    decodeOrderDatumData(orderTxInput.datum, isMainnet)
  );
  if (!decodedResult.ok) {
    return Err(new Error(`Invalid Order Datum: ${decodedResult.error}`));
  }

  const { amount } = decodedResult.data;
  if (amount > maxOrderAmountInOneTx) {
    return Err(
      new Error(
        `Order Tx Input has too many amount ${amount}. maximum: ${maxOrderAmountInOneTx}`
      )
    );
  }

  if (amount === 0) {
    return Err(new Error("Order TxInput has 0 amount"));
  }

  return Ok(true);
};

export type {
  CancelParams,
  FetchOrderTxInputsParams,
  IsOrderTxInputValidParams,
  RefundParams,
  RequestParams,
};
export { cancel, fetchOrderTxInputs, isOrderTxInputValid, refund, request };
