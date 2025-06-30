import { ShelleyAddress } from "@helios-lang/ledger";
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

import { SettingsV1 } from "../types/index.js";
import { buildAddressData, decodeAddressFromData } from "./common.js";

const buildSettingsV1Data = (settings: SettingsV1): UplcData => {
  const {
    policy_id,
    allowed_minter,
    hal_nft_price,
    minting_data_script_hash,
    orders_spend_script_hash,
    ref_spend_proxy_script_hash,
    ref_spend_governor,
    ref_spend_admin,
    royalty_spend_script_hash,
    max_order_amount,
    minting_start_time,
    payment_address,
  } = settings;

  return makeConstrData(0, [
    makeByteArrayData(policy_id),
    makeByteArrayData(allowed_minter),
    makeIntData(hal_nft_price),
    makeByteArrayData(minting_data_script_hash),
    makeByteArrayData(orders_spend_script_hash),
    makeByteArrayData(ref_spend_proxy_script_hash),
    makeByteArrayData(ref_spend_governor),
    makeByteArrayData(ref_spend_admin),
    makeByteArrayData(royalty_spend_script_hash),
    makeIntData(max_order_amount),
    makeIntData(minting_start_time),
    buildAddressData(payment_address as ShelleyAddress),
  ]);
};

const decodeSettingsV1Data = (
  data: UplcData,
  network: NetworkName
): SettingsV1 => {
  const settingsV1ConstrData = expectConstrData(data, 0, 12);

  // policy_id
  const policy_id = expectByteArrayData(
    settingsV1ConstrData.fields[0],
    "policy_id must be ByteArray"
  ).toHex();

  // allowed_minter
  const allowed_minter = expectByteArrayData(
    settingsV1ConstrData.fields[1],
    "allowed_minter must be ByteArray"
  ).toHex();

  // hal_nft_price
  const hal_nft_price = expectIntData(
    settingsV1ConstrData.fields[2],
    "hal_nft_price must be Int"
  ).value;

  // minting_data_script_hash
  const minting_data_script_hash = expectByteArrayData(
    settingsV1ConstrData.fields[3],
    "minting_data_script_hash must be ByteArray"
  ).toHex();

  // orders_spend_script_hash
  const orders_spend_script_hash = expectByteArrayData(
    settingsV1ConstrData.fields[4],
    "orders_spend_script_hash must be ByteArray"
  ).toHex();

  // ref_spend_proxy_script_hash
  const ref_spend_proxy_script_hash = expectByteArrayData(
    settingsV1ConstrData.fields[5],
    "ref_spend_proxy_script_hash must be ByteArray"
  ).toHex();

  // ref_spend_governor
  const ref_spend_governor = expectByteArrayData(
    settingsV1ConstrData.fields[6],
    "ref_spend_governor must be ByteArray"
  ).toHex();

  // ref_spend_admin
  const ref_spend_admin = expectByteArrayData(
    settingsV1ConstrData.fields[7],
    "ref_spend_admin must be ByteArray"
  ).toHex();

  // royalty_spend_script_hash
  const royalty_spend_script_hash = expectByteArrayData(
    settingsV1ConstrData.fields[8],
    "royalty_spend_script_hash must be ByteArray"
  ).toHex();

  // max_order_amount
  const max_order_amount = Number(
    expectIntData(
      settingsV1ConstrData.fields[9],
      "max_order_amount must be Int"
    ).value
  );

  // minting_start_time
  const minting_start_time = Number(
    expectIntData(
      settingsV1ConstrData.fields[10],
      "minting_start_time must be Int"
    ).value
  );

  // payment_address
  const payment_address = decodeAddressFromData(
    settingsV1ConstrData.fields[11],
    network
  );

  return {
    policy_id,
    allowed_minter,
    hal_nft_price,
    minting_data_script_hash,
    orders_spend_script_hash,
    ref_spend_proxy_script_hash,
    ref_spend_governor,
    ref_spend_admin,
    royalty_spend_script_hash,
    max_order_amount,
    minting_start_time,
    payment_address,
  };
};

export { buildSettingsV1Data, decodeSettingsV1Data };
