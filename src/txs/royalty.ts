import { ByteArrayLike, IntLike } from "@helios-lang/codec-utils";
import {
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeMintingPolicyHash,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { ROYALTY_ASSET_FULL_NAME } from "../constants/index.js";
import {
  buildMintV1MintRoyaltyNFTRedeemer,
  buildRoyaltyDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  makeVoidData,
  RoyaltyDatum,
} from "../contracts/index.js";
import { mayFail } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";

/**
 * @interface
 * @typedef {object} MintRoyaltyParams
 * @property {NetworkName} network Network
 * @property {RoyaltyDatum} royaltyDatum Royalty Datum
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 */
interface MintRoyaltyParams {
  network: NetworkName;
  royaltyDatum: RoyaltyDatum;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
}

/**
 * @description Mint Royalty token
 * @param {RequestParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const mintRoyalty = async (
  params: MintRoyaltyParams
): Promise<Result<TxBuilder, Error>> => {
  const { network, royaltyDatum, deployedScripts, settingsAssetTxInput } =
    params;
  const isMainnet = network == "mainnet";

  const { mintProxyScriptTxInput, mintV1ScriptDetails, mintV1ScriptTxInput } =
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
  const { policy_id, allowed_minter, royalty_spend_script_address } =
    settingsV1Result.data;

  // hal policy id
  const halPolicyHash = makeMintingPolicyHash(policy_id);

  // make Mint V1 Mint Royalty NFT Redeemer
  const mintV1MintRoyaltyNFTRedeemer = buildMintV1MintRoyaltyNFTRedeemer();

  // make token value to mint
  const royaltyTokenValue: [ByteArrayLike, IntLike][] = [
    [ROYALTY_ASSET_FULL_NAME, 1n],
  ];

  // make royalty NFT value
  const royaltyNFTValue = makeValue(
    1n,
    makeAssets([
      [makeAssetClass(`${policy_id}.${ROYALTY_ASSET_FULL_NAME}`), 1n],
    ])
  );

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- add required signer
  txBuilder.addSigners(makePubKeyHash(allowed_minter));

  // <-- attach settings asset as reference input
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach deployed scripts
  txBuilder.refer(mintProxyScriptTxInput, mintV1ScriptTxInput);

  // <-- withdraw from mint v1 withdrawal validator (script from reference input)
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(mintV1ScriptDetails.validatorHash)
    ),
    0n,
    mintV1MintRoyaltyNFTRedeemer
  );

  // <-- mint royalty NFT
  txBuilder.mintPolicyTokensUnsafe(
    halPolicyHash,
    royaltyTokenValue,
    makeVoidData()
  );

  // <-- pay royalty NFT to royalty spend script address
  txBuilder.payUnsafe(
    royalty_spend_script_address,
    royaltyNFTValue,
    makeInlineTxOutputDatum(buildRoyaltyDatumData(royaltyDatum))
  );

  return Ok(txBuilder);
};

export type { MintRoyaltyParams };
export { mintRoyalty };
