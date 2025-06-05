import { TxOutputDatum } from "@helios-lang/ledger";
import { NetworkName } from "@helios-lang/tx-utils";
import {
  expectByteArrayData,
  expectConstrData,
  expectIntData,
  makeByteArrayData,
  makeConstrData,
  makeIntData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";

import { invariant } from "../../helpers/index.js";
import { Order, OrderDatum } from "../types/index.js";
import { buildAddressData, decodeAddressFromData } from "./common.js";

const decodeOrderDatumData = (
  datum: TxOutputDatum | undefined,
  network: NetworkName
): OrderDatum => {
  invariant(
    datum?.kind == "InlineTxOutputDatum",
    "OrderDatum must be inline datum"
  );
  const datumData = datum.data;
  const orderConstrData = expectConstrData(datumData, 0, 4);

  const owner_key_hash = expectByteArrayData(orderConstrData.fields[0]).toHex();
  const price = expectIntData(orderConstrData.fields[1]).value;
  const destination_address = decodeAddressFromData(
    orderConstrData.fields[2],
    network
  );
  const amount = Number(expectIntData(orderConstrData.fields[3]).value);

  return {
    owner_key_hash,
    price,
    destination_address,
    amount,
  };
};

const buildOrderDatumData = (order: OrderDatum): UplcData => {
  const { owner_key_hash, price, destination_address, amount } = order;
  return makeConstrData(0, [
    makeByteArrayData(owner_key_hash),
    makeIntData(price),
    buildAddressData(destination_address),
    makeIntData(amount),
  ]);
};

const buildOrdersMintMintOrdersRedeemer = (orders: Order[]): UplcData => {
  return makeConstrData(0, [makeListData(orders.map(buildOrderData))]);
};

const buildOrderData = (order: Order): UplcData => {
  const [destination_address, amount] = order;

  return makeListData([
    buildAddressData(destination_address),
    makeIntData(amount),
  ]);
};

const buildOrdersMintBurnOrdersRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

const buildOrdersSpendExecuteOrdersRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildOrdersSpendCancelOrderRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export {
  buildOrderDatumData,
  buildOrdersMintBurnOrdersRedeemer,
  buildOrdersMintMintOrdersRedeemer,
  buildOrdersSpendCancelOrderRedeemer,
  buildOrdersSpendExecuteOrdersRedeemer,
  decodeOrderDatumData,
};
