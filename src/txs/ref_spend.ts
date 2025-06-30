import {
  InlineTxOutputDatum,
  makeAddress,
  makeAssetClass,
  makeAssets,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeValidatorHash,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { PREFIX_100, PREFIX_222 } from "../constants/index.js";
import {
  buildRefSpendRedeemer,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  makeVoidData,
} from "../contracts/index.js";
import { mayFail } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";

/**
 * @interface
 * @typedef {object} UpdateParams
 * @property {NetworkName} network Network
 * @property {string} assetUtf8Name The Utf8 name of H.A.L NFT to update datum
 * @property {TxInput} refTxInput The UTxO where reference asset is locked
 * @property {TxInput} userTxInput The UTxO where user asset is locked
 * @property {InlineTxOutputDatum} newDatum The new datum to update with
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 */
interface UpdateParams {
  network: NetworkName;
  assetUtf8Name: string;
  refTxInput: TxInput;
  userTxInput: TxInput;
  newDatum: InlineTxOutputDatum;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
}

/**
 * @description Update reference asset's datum
 * @param {UpdateParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const update = async (
  params: UpdateParams
): Promise<Result<TxBuilder, Error>> => {
  const {
    network,
    assetUtf8Name,
    refTxInput,
    userTxInput,
    newDatum,
    settingsAssetTxInput,
    deployedScripts,
  } = params;
  const isMainnet = network == "mainnet";
  const assetHexName = Buffer.from(assetUtf8Name).toString("hex");

  const {
    refSpendProxyScriptTxInput,
    refSpendScriptDetails,
    refSpendScriptTxInput,
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
  const { policy_id, ref_spend_proxy_script_hash, ref_spend_admin } =
    settingsV1Result.data;

  const refSpendProxyScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ref_spend_proxy_script_hash)
  );

  // reference asset value
  const refAssetName = `${PREFIX_100}${assetHexName}`;
  const refAssetClass = makeAssetClass(`${policy_id}.${refAssetName}`);
  const refAsset = makeAssets([[refAssetClass, 1n]]);

  // user asset value
  const userAssetName = `${PREFIX_222}${assetHexName}`;
  const userAssetClass = makeAssetClass(`${policy_id}.${userAssetName}`);
  const userAsset = makeAssets([[userAssetClass, 1n]]);

  // check refTxInput has ref asset
  if (!refTxInput.value.isGreaterOrEqual(makeValue(0n, refAsset))) {
    return Err(new Error("Reference asset not found."));
  }

  // check userTxInput has user asset
  if (!userTxInput.value.isGreaterOrEqual(makeValue(0n, userAsset))) {
    return Err(new Error("User asset not found."));
  }

  // make redeemer
  const refSpendRedeemer = buildRefSpendRedeemer(assetHexName);

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach Settings asset
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach ref_spend_proxy, ref_spend scripts
  txBuilder.refer(refSpendProxyScriptTxInput, refSpendScriptTxInput);

  // <-- withdraw from ref_spend script
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(refSpendScriptDetails.validatorHash)
    ),
    0n,
    refSpendRedeemer
  );

  // <-- add ref_spend_admin signer
  txBuilder.addSigners(makePubKeyHash(ref_spend_admin));

  // <-- spend refTxInput
  txBuilder.spendUnsafe(refTxInput, makeVoidData());

  // <-- spend userTxInput
  txBuilder.spendUnsafe(userTxInput);

  // <-- pay ref asset with updated datum
  txBuilder.payUnsafe(
    refSpendProxyScriptAddress,
    makeValue(0n, refAsset),
    newDatum
  );

  return Ok(txBuilder);
};

export { update };
export type { UpdateParams };
