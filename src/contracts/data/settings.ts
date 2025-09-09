import { TxOutputDatum } from "@helios-lang/ledger";
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
import { RefSpendSettings, Settings } from "../types/index.js";

const buildSettingsData = (settings: Settings): UplcData => {
  const { mint_governor, mint_version, data } = settings;
  return makeConstrData(0, [
    makeByteArrayData(mint_governor),
    makeIntData(mint_version),
    data,
  ]);
};

const decodeSettingsDatum = (datum: TxOutputDatum | undefined): Settings => {
  invariant(
    datum?.kind == "InlineTxOutputDatum",
    "Settings must be inline datum"
  );
  const datumData = datum.data;
  const settingsConstrData = expectConstrData(datumData, 0, 3);

  const mint_governor = expectByteArrayData(
    settingsConstrData.fields[0],
    "mint_governor must be ByteArray"
  ).toHex();

  const mint_version = expectIntData(settingsConstrData.fields[1]).value;

  const data = settingsConstrData.fields[2];

  return {
    mint_governor,
    mint_version,
    data,
  };
};

const buildRefSpendSettingsData = (settings: RefSpendSettings): UplcData => {
  const { ref_spend_governor, data } = settings;
  return makeConstrData(0, [makeByteArrayData(ref_spend_governor), data]);
};

const decodeRefSpendSettingsDatum = (
  datum: TxOutputDatum | undefined
): RefSpendSettings => {
  invariant(
    datum?.kind == "InlineTxOutputDatum",
    "RefSpendSettings must be inline datum"
  );
  const datumData = datum.data;
  const refSpendSettingsConstrData = expectConstrData(datumData, 0, 2);

  const ref_spend_governor = expectByteArrayData(
    refSpendSettingsConstrData.fields[0],
    "ref_spend_governor must be ByteArray"
  ).toHex();

  const data = refSpendSettingsConstrData.fields[1];

  return {
    ref_spend_governor,
    data,
  };
};

export {
  buildRefSpendSettingsData,
  buildSettingsData,
  decodeRefSpendSettingsDatum,
  decodeSettingsDatum,
};
