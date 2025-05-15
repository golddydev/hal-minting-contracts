import {
  makeAddress,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeTxInput,
  makeTxOutput,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { NetworkName } from "@helios-lang/tx-utils";
import { decodeUplcData } from "@helios-lang/uplc";
import { Err, Ok, Result } from "ts-res";

import {
  LEGACY_POLICY_ID,
  MINTING_DATA_HANDLE_NAME,
  SETTINGS_HANDLE_NAME,
} from "../constants/index.js";
import {
  decodeMintingDataDatum,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  MintingData,
  Settings,
  SettingsV1,
} from "../contracts/index.js";
import { fetchApi, mayFail } from "../helpers/index.js";

const fetchSettings = async (
  network: NetworkName
): Promise<
  Result<
    {
      settings: Settings;
      settingsV1: SettingsV1;
      settingsAssetTxInput: TxInput;
    },
    string
  >
> => {
  const settingsHandle = await fetchApi(`handles/${SETTINGS_HANDLE_NAME}`).then(
    (res) => res.json()
  );
  const settingsHandleDatum: string = await fetchApi(
    `handles/${SETTINGS_HANDLE_NAME}/datum`,
    { "Content-Type": "text/plain" }
  ).then((res) => res.text());

  if (!settingsHandleDatum) {
    throw new Error("Settings Datum Not Found");
  }

  const settingsAssetTxInput = makeTxInput(
    settingsHandle.utxo,
    makeTxOutput(
      makeAddress(settingsHandle.resolved_addresses.ada),
      makeValue(
        BigInt(1),
        makeAssets([
          [makeAssetClass(`${LEGACY_POLICY_ID}.${settingsHandle.hex}`), 1n],
        ])
      ),
      makeInlineTxOutputDatum(decodeUplcData(settingsHandleDatum))
    )
  );

  const decodedSettingsResult = mayFail(() =>
    decodeSettingsDatum(settingsAssetTxInput.datum)
  );
  if (!decodedSettingsResult.ok) {
    return Err(decodedSettingsResult.error);
  }

  const decodedSettingsV1Result = mayFail(() =>
    decodeSettingsV1Data(decodedSettingsResult.data.data, network)
  );
  if (!decodedSettingsV1Result.ok) return Err(decodedSettingsV1Result.error);

  return Ok({
    settings: decodedSettingsResult.data,
    settingsV1: decodedSettingsV1Result.data,
    settingsAssetTxInput,
  });
};

const fetchMintingData = async (): Promise<
  Result<{ mintingData: MintingData; mintingDataAssetTxInput: TxInput }, string>
> => {
  const [mintingDataHandle, mintingDataUtxo, mintingDataHandleDatum] =
    await Promise.all([
      fetchApi(`handles/${MINTING_DATA_HANDLE_NAME}`).then((res) => res.json()),
      fetchApi(`handles/${MINTING_DATA_HANDLE_NAME}/utxo`).then((res) =>
        res.json()
      ),
      fetchApi(`handles/${MINTING_DATA_HANDLE_NAME}/datum`, {
        "Content-Type": "text/plain",
      }).then((res) => res.text()),
    ]);

  if (!mintingDataHandleDatum) {
    throw new Error("Minting Data Datum Not Found");
  }

  const mintingDataAssetTxInput = makeTxInput(
    mintingDataHandle.utxo,
    makeTxOutput(
      makeAddress(mintingDataHandle.resolved_addresses.ada),
      makeValue(
        BigInt(mintingDataUtxo.lovelace),
        makeAssets([
          [makeAssetClass(`${LEGACY_POLICY_ID}.${mintingDataHandle.hex}`), 1n],
        ])
      ),
      makeInlineTxOutputDatum(decodeUplcData(mintingDataHandleDatum))
    )
  );

  const decodedMintingDataResult = mayFail(() =>
    decodeMintingDataDatum(mintingDataAssetTxInput.datum)
  );
  if (!decodedMintingDataResult.ok) {
    return Err(decodedMintingDataResult.error);
  }

  return Ok({
    mintingData: decodedMintingDataResult.data,
    mintingDataAssetTxInput,
  });
};

export { fetchMintingData, fetchSettings };
