import { Trie } from "@aiken-lang/merkle-patricia-forestry";
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
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { ScriptDetails } from "@koralabs/kora-labs-common";
import { Err, Ok, Result } from "ts-res";

import {
  buildOrderDatumData,
  buildOrdersSpendCancelOrderRedeemer,
  buildOrdersSpendRefundOrderRedeemer,
  decodeOrderDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  decodeWhitelistedItem,
  OrderDatum,
  Settings,
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
 * @property {Settings} settings Settings
 */
interface RequestParams {
  network: NetworkName;
  orders: Order[];
  settings: Settings;
}

/**
 * @description Request asset to be minted
 * @param {RequestParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const request = async (
  params: RequestParams
): Promise<Result<TxBuilder, Error>> => {
  const { network, orders, settings } = params;
  const isMainnet = network == "mainnet";

  for (const [address, amount] of orders) {
    if (address.spendingCredential.kind == "ValidatorHash")
      return Err(new Error("Must be Base address"));

    if (amount <= 0n) {
      return Err(new Error("Amount must be greater than 0"));
    }
  }

  // decode settings
  const { data: settingsV1Data } = settings;
  const settingsV1Result = mayFail(() =>
    decodeSettingsV1Data(settingsV1Data, network)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const { hal_nft_price, orders_spend_script_hash } = settingsV1Result.data;

  const ordersSpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(orders_spend_script_hash)
  );

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- pay order value to order spend script address for each order
  for (const [address, amount] of orders) {
    const orderDatum: OrderDatum = {
      owner_key_hash: address.spendingCredential.toHex(),
      destination_address: address,
      amount,
    };

    const orderValue = makeValue(hal_nft_price * BigInt(amount));

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
    decodeOrderDatumData(orderTxInput.datum, network)
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

/**
 * @interface
 * @typedef {object} RefundParams
 * @property {NetworkName} network Network
 * @property {TxInput} orderTxInput Order Tx Input to refund
 * @property {ShelleyAddress} refundingAddress Address to refund Order Tx Input
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 */
interface RefundParams {
  network: NetworkName;
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
    network,
    orderTxInput,
    refundingAddress,
    deployedScripts,
    settingsAssetTxInput,
  } = params;
  const isMainnet = network == "mainnet";

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
    decodeSettingsV1Data(settingsV1Data, network)
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
    decodeOrderDatumData(orderTxInput.datum, network)
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

/**
 * @interface
 * @typedef {object} FetchOrderTxInputsParams
 * @property {ScriptDetails} ordersSpendScriptDetails Deployed Orders Spend Script Detail
 * @property {string} blockfrostApiKey Blockfrost API Key
 */
interface FetchOrderTxInputsParams {
  ordersSpendScriptDetails: ScriptDetails;
  blockfrostApiKey: string;
}

/**
 * @description Fetch Order UTxOs
 * @param {FetchOrderTxInputsParams} params
 * @returns {Promise<Result<TxInput[], Error>>} Transaction Result
 */
const fetchOrderTxInputs = async (
  params: FetchOrderTxInputsParams
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
 * @property {Settings} settings Settings
 * @property {Trie} whitelistDB Whitelist DB
 * @property {number | undefined} mintingTime Minting Time
 */
interface IsValidOrderTxInputParams {
  network: NetworkName;
  orderTxInput: TxInput;
  settings: Settings;
  whitelistDB: Trie;
  mintingTime?: number | undefined;
}

/**
 * @description Check TxInput is valid order UTxO
 * @param {IsValidOrderTxInputParams} params
 * @returns {boolean} True if valid order UTxO, false otherwise
 */
const isValidOrderTxInput = async (
  params: IsValidOrderTxInputParams
): Promise<Result<true, Error>> => {
  const {
    network,
    orderTxInput,
    settings,
    whitelistDB,
    mintingTime = Date.now(),
  } = params;
  const isMainnet = network == "mainnet";
  const { data: settingsV1Data } = settings;
  const settingsV1Result = mayFail(() =>
    decodeSettingsV1Data(settingsV1Data, network)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const { hal_nft_price, orders_spend_script_hash, minting_start_time } =
    settingsV1Result.data;

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
    decodeOrderDatumData(orderTxInput.datum, network)
  );
  if (!decodedResult.ok) {
    return Err(new Error("Invalid Order Datum"));
  }
  const { destination_address, amount: ordered_amount } = decodedResult.data;

  // check lovelace is enough
  const expectedLovelace = BigInt(ordered_amount) * hal_nft_price;
  if (orderTxInput.value.lovelace < expectedLovelace) {
    return Err(new Error("Insufficient Lovelace"));
  }

  // check minting time
  if (mintingTime < minting_start_time) {
    // check whitelisted or not
    const key = Buffer.from(destination_address.toUplcData().toCbor());
    const value = await whitelistDB.get(key);
    if (!value) {
      return Err(
        new Error(
          `${destination_address.toBech32()} is not whitelisted. Wait until ${new Date(
            minting_start_time
          ).toLocaleString()}`
        )
      );
    }

    // check whitelisted time gap and amount
    const decodedWhitelistedItemResult = decodeWhitelistedItem(value);
    if (!decodedWhitelistedItemResult.ok) {
      return Err(
        new Error(
          `${destination_address.toBech32()} has invalid whitelisted item data in Trie: ${
            decodedWhitelistedItemResult.error
          }`
        )
      );
    }
    const [time_gap, amount] = decodedWhitelistedItemResult.data;
    const whitelistedTime = minting_start_time - time_gap;
    if (mintingTime < whitelistedTime) {
      return Err(
        new Error(
          `${destination_address.toBech32()} is whitelisted but couldn't mint yet. Wait until ${new Date(
            whitelistedTime
          ).toLocaleString()}`
        )
      );
    }

    if (ordered_amount > amount) {
      return Err(
        new Error(
          `${destination_address.toBech32()} has ${amount} whitelisted amount but order amount is ${ordered_amount}`
        )
      );
    }
  }

  return Ok(true);
};

export type {
  CancelParams,
  FetchOrderTxInputsParams,
  IsValidOrderTxInputParams,
  RefundParams,
  RequestParams,
};
export { cancel, fetchOrderTxInputs, isValidOrderTxInput, refund, request };
