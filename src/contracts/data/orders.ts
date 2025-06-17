import { TxOutputDatum } from "@helios-lang/ledger";
import { NetworkName } from "@helios-lang/tx-utils";
import {
  expectByteArrayData,
  expectConstrData,
  expectIntData,
  makeByteArrayData,
  makeConstrData,
  makeIntData,
  UplcData,
} from "@helios-lang/uplc";

import { invariant } from "../../helpers/index.js";
import { OrderDatum } from "../types/index.js";
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
  const orderConstrData = expectConstrData(datumData, 0, 3);

  const owner_key_hash = expectByteArrayData(orderConstrData.fields[0]).toHex();
  const destination_address = decodeAddressFromData(
    orderConstrData.fields[1],
    network
  );
  const amount = Number(expectIntData(orderConstrData.fields[2]).value);

  return {
    owner_key_hash,
    destination_address,
    amount,
  };
};

const buildOrderDatumData = (order: OrderDatum): UplcData => {
  const { owner_key_hash, destination_address, amount } = order;
  return makeConstrData(0, [
    makeByteArrayData(owner_key_hash),
    buildAddressData(destination_address),
    makeIntData(amount),
  ]);
};

const buildOrdersSpendExecuteOrdersRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildOrdersSpendCancelOrderRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

const buildOrdersSpendRefundOrderRedeemer = (): UplcData => {
  return makeConstrData(2, []);
};

export {
  buildOrderDatumData,
  buildOrdersSpendCancelOrderRedeemer,
  buildOrdersSpendExecuteOrdersRedeemer,
  buildOrdersSpendRefundOrderRedeemer,
  decodeOrderDatumData,
};
