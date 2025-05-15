import {
  InlineTxOutputDatum,
  makeAssetClass,
  makeAssets,
  makePubKeyHash,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { fetchSettings } from "../configs/index.js";
import { PREFIX_100, PREFIX_222 } from "../constants/index.js";
import { buildCip68UpdateRedeemer } from "../contracts/index.js";
import { DeployedScripts } from "./deploy.js";

/**
 * @interface
 * @typedef {object} UpdateParams
 * @property {NetworkName} network Network
 * @property {string} assetUtf8Name The Utf8 name of H.A.L NFT to update datum
 * @property {TxInput} refTxInput The UTxO where reference asset is locked
 * @property {TxInput} userTxInput The UTxO where user asset is locked
 * @property {InlineTxOutputDatum} newDatum The new datum to update with
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 */
interface UpdateParams {
  network: NetworkName;
  assetUtf8Name: string;
  refTxInput: TxInput;
  userTxInput: TxInput;
  newDatum: InlineTxOutputDatum;
  deployedScripts: DeployedScripts;
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
    deployedScripts,
  } = params;
  const isMainnet = network == "mainnet";
  const assetHexName = Buffer.from(assetUtf8Name).toString("hex");

  const { cip68ScriptTxInput } = deployedScripts;

  // fetch settings
  const settingsResult = await fetchSettings(network);
  if (!settingsResult.ok)
    return Err(new Error(`Failed to fetch settings: ${settingsResult.error}`));
  const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
  const { policy_id, cip68_admin, cip68_script_address } = settingsV1;

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
  const cip68UpdateRedeemer = buildCip68UpdateRedeemer(assetHexName);

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- attach Settings asset
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach CIP68 script
  txBuilder.refer(cip68ScriptTxInput);

  // <-- add cip68_admin signer
  txBuilder.addSigners(makePubKeyHash(cip68_admin));

  // <-- spend refTxInput
  txBuilder.spendUnsafe(refTxInput, cip68UpdateRedeemer);

  // <-- spend userTxInput
  txBuilder.spendUnsafe(userTxInput);

  // <-- pay ref asset with updated datum
  txBuilder.payUnsafe(cip68_script_address, makeValue(0n, refAsset), newDatum);

  return Ok(txBuilder);
};

export { update };
export type { UpdateParams };
