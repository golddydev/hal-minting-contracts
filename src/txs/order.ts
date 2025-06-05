import { IntLike } from "@helios-lang/codec-utils";
import { ByteArrayLike } from "@helios-lang/codec-utils";
import {
  Address,
  makeAddress,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeMintingPolicyHash,
  makePubKeyHash,
  makeValidatorHash,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { ScriptDetails } from "@koralabs/kora-labs-common";
import { Err, Ok, Result } from "ts-res";

import { ORDER_ASSET_HEX_NAME } from "../constants/index.js";
import {
  buildOrderDatumData,
  buildOrdersMintBurnOrdersRedeemer,
  buildOrdersMintMintOrdersRedeemer,
  buildOrdersSpendCancelOrderRedeemer,
  decodeOrderDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  OrderDatum,
} from "../contracts/index.js";
import { Order } from "../contracts/types/orders.js";
import {
  getBlockfrostV0Client,
  getNetwork,
  mayFail,
  mayFailAsync,
} from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";

/**
 * @interface
 * @typedef {object} RequestParams
 * @property {NetworkName} network Network
 * @property {Order[]} orders Orders to request
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 */
interface RequestParams {
  network: NetworkName;
  orders: Order[];
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
}

/**
 * @description Request asset to be minted
 * @param {RequestParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const request = async (
  params: RequestParams
): Promise<Result<TxBuilder, Error>> => {
  const { network, orders, deployedScripts, settingsAssetTxInput } = params;
  const isMainnet = network == "mainnet";

  for (const [address, amount] of orders) {
    if (address.spendingCredential.kind == "ValidatorHash")
      return Err(new Error("Must be Base address"));

    if (amount <= 0n) {
      return Err(new Error("Amount must be greater than 0"));
    }
  }

  const {
    ordersMintScriptTxInput,
    ordersMintScriptDetails,
    ordersSpendScriptDetails,
  } = deployedScripts;

  // decode settings
  const settingsResult = mayFail(() =>
    decodeSettingsDatum(settingsAssetTxInput.datum)
  );
  if (!settingsResult.ok) {
    return Err(new Error(`Failed to decode settings: ${settingsResult.error}`));
  }
  const { data: settingsV1Data } = settingsResult.data;
  const settingsV1Result = mayFail(() =>
    decodeSettingsV1Data(settingsV1Data, network)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const { orders_minter, max_order_amount, hal_nft_price } =
    settingsV1Result.data;

  // check amount is not greater than max_order_amount
  for (const [_, amount] of orders) {
    if (amount > max_order_amount) {
      return Err(
        new Error(
          `Amount must be less than or equal to ${max_order_amount} (max_order_amount)`
        )
      );
    }
  }

  const ordersCount = orders.length;

  // orders spend script address
  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );

  // order token policy id
  const ordersMintPolicyHash = makeMintingPolicyHash(
    makeValidatorHash(ordersMintScriptDetails.validatorHash)
  );

  // order value
  const orderTokenAssetClass = makeAssetClass(
    ordersMintPolicyHash,
    ORDER_ASSET_HEX_NAME
  );
  const orderTokenValue: [ByteArrayLike, IntLike][] = [
    [orderTokenAssetClass.tokenName, BigInt(ordersCount)],
  ];

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach settings asset as reference input
  txBuilder.refer(settingsAssetTxInput);

  // <-- add orders_minter signer
  txBuilder.addSigners(makePubKeyHash(orders_minter));

  // <-- attach orders mint script
  txBuilder.refer(ordersMintScriptTxInput);

  // <-- mint order token
  txBuilder.mintPolicyTokensUnsafe(
    ordersMintPolicyHash,
    orderTokenValue,
    buildOrdersMintMintOrdersRedeemer(orders)
  );

  // <-- pay order value to order spend script address for each order
  for (const [address, amount] of orders) {
    const orderDatum: OrderDatum = {
      owner_key_hash: address.spendingCredential.toHex(),
      price: hal_nft_price,
      destination_address: address,
      amount,
    };

    const orderValue = makeValue(
      hal_nft_price * BigInt(amount),
      makeAssets([[orderTokenAssetClass, 1n]])
    );

    txBuilder.payUnsafe(
      ordersSpendScriptAddress,
      orderValue,
      makeInlineTxOutputDatum(buildOrderDatumData(orderDatum))
    );
  }

  return Ok(txBuilder);
};

/**
 * @interface
 * @typedef {object} CancelParams
 * @property {NetworkName} network Network
 * @property {Address} address User's Wallet Address to perform order
 * @property {TxInput} orderTxInput Order Tx Input
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 */
interface CancelParams {
  network: NetworkName;
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
  const { network, address, orderTxInput, deployedScripts } = params;
  const isMainnet = network == "mainnet";
  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));
  if (address.spendingCredential.kind == "ValidatorHash")
    return Err(new Error("Must be Base address"));

  const {
    ordersMintScriptTxInput,
    ordersMintScriptDetails,
    ordersSpendScriptTxInput,
    ordersSpendScriptDetails,
  } = deployedScripts;

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

  // order token policy id
  const ordersMintPolicyHash = makeMintingPolicyHash(
    makeValidatorHash(ordersMintScriptDetails.validatorHash)
  );

  // order value
  const orderTokenAssetClass = makeAssetClass(
    ordersMintPolicyHash,
    ORDER_ASSET_HEX_NAME
  );
  const orderTokenValue: [ByteArrayLike, IntLike][] = [
    [orderTokenAssetClass.tokenName, -1n],
  ];

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach orders spend and mint scripts
  txBuilder.refer(ordersMintScriptTxInput, ordersSpendScriptTxInput);

  // <-- spend order tx input
  txBuilder.spendUnsafe(orderTxInput, buildOrdersSpendCancelOrderRedeemer());

  // <-- burn order token value
  txBuilder.mintPolicyTokensUnsafe(
    ordersMintPolicyHash,
    orderTokenValue,
    buildOrdersMintBurnOrdersRedeemer()
  );

  // <-- add signer
  txBuilder.addSigners(address.spendingCredential);

  return Ok(txBuilder);
};

/**
 * @interface
 * @typedef {object} FetchOrdersTxInputsParams
 * @property {ScriptDetails} ordersSpendScriptDetails Deployed Orders Spend Script Detail
 * @property {string} blockfrostApiKey Blockfrost API Key
 */
interface FetchOrdersTxInputsParams {
  ordersSpendScriptDetails: ScriptDetails;
  blockfrostApiKey: string;
}

/**
 * @description Fetch Orders UTxOs
 * @param {FetchOrdersTxInputsParams} params
 * @returns {Promise<Result<TxInput[], Error>>} Transaction Result
 */
const fetchOrdersTxInputs = async (
  params: FetchOrdersTxInputsParams
): Promise<Result<TxInput[], Error>> => {
  const { ordersSpendScriptDetails, blockfrostApiKey } = params;
  const network = getNetwork(blockfrostApiKey);
  const isMainnet = network == "mainnet";
  const blockfrostV0Client = getBlockfrostV0Client(blockfrostApiKey);

  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );

  // fetch order utxos
  const orderUtxosResult = await mayFailAsync(() =>
    blockfrostV0Client.getUtxos(ordersSpendScriptAddress)
  ).complete();
  if (!orderUtxosResult.ok)
    return Err(
      new Error(`Failed to fetch order UTxOs: ${orderUtxosResult.error}`)
    );

  // remove invalid order utxos
  const orderUtxos = orderUtxosResult.data.filter((utxo) => {
    const decodedResult = mayFail(() =>
      decodeOrderDatumData(utxo.datum, network)
    );
    return decodedResult.ok;
  });

  return Ok(orderUtxos);
};

/**
 * @interface
 * @typedef {object} IsValidOrderTxInputParams
 * @property {NetworkName} network Network
 * @property {TxInput} orderTxInput Order TxInput
 * @property {Address} ordersSpendScriptAddress Orders Spend Script Address
 * @property {number} maxOrderAmount max_order_amount from Settings
 */
interface IsValidOrderTxInputParams {
  network: NetworkName;
  orderTxInput: TxInput;
  ordersSpendScriptDetails: ScriptDetails;
  maxOrderAmount: number;
  halNftPrice: bigint;
}

/**
 * @description Check TxInput is valid order UTxO
 * @param {IsValidOrderTxInputParams} params
 * @returns {boolean} True if valid order UTxO, false otherwise
 */
const isValidOrderTxInput = (
  params: IsValidOrderTxInputParams
): Result<true, Error> => {
  const {
    network,
    orderTxInput,
    ordersSpendScriptDetails,
    maxOrderAmount,
    halNftPrice,
  } = params;
  const isMainnet = network == "mainnet";
  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ordersSpendScriptDetails.validatorHash)
  );

  // check if address matches
  if (!orderTxInput.address.isEqual(ordersSpendScriptAddress)) {
    return Err(
      new Error("Order TxInput must be from Orders Spend Script Address")
    );
  }

  // check if datum is valid
  const decodedResult = mayFail(() =>
    decodeOrderDatumData(orderTxInput.datum, network)
  );
  if (!decodedResult.ok) {
    return Err(new Error("Invalid Order Datum"));
  }
  const { amount } = decodedResult.data;

  // check amount
  if (amount > maxOrderAmount) {
    return Err(
      new Error(
        `Amount must be less than or equal to ${maxOrderAmount} (max_order_amount)`
      )
    );
  }

  // check lovelace is enough
  const expectedLovelace = BigInt(amount) * halNftPrice;
  if (orderTxInput.value.lovelace < expectedLovelace) {
    return Err(new Error("Insufficient Lovelace"));
  }

  return Ok(true);
};

export type {
  CancelParams,
  FetchOrdersTxInputsParams,
  IsValidOrderTxInputParams,
  RequestParams,
};
export { cancel, fetchOrdersTxInputs, isValidOrderTxInput, request };
