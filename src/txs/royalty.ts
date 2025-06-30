import { ByteArrayLike, IntLike } from "@helios-lang/codec-utils";
import {
  makeAddress,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeMintingPolicyHash,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeValidatorHash,
  makeValue,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { ROYALTY_ASSET_FULL_NAME } from "../constants/index.js";
import {
  buildMintMintRoyaltyNFTRedeemer,
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

  const { mintProxyScriptTxInput, mintScriptDetails, mintScriptTxInput } =
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
  const { policy_id, allowed_minter, royalty_spend_script_hash } =
    settingsV1Result.data;

  const royaltySpendScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(royalty_spend_script_hash)
  );

  // hal policy id
  const halPolicyHash = makeMintingPolicyHash(policy_id);

  // make Mint V1 Mint Royalty NFT Redeemer
  const mintMintRoyaltyNFTRedeemer = buildMintMintRoyaltyNFTRedeemer();

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
  txBuilder.refer(mintProxyScriptTxInput, mintScriptTxInput);

  // <-- withdraw from mint withdrawal validator (script from reference input)
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(mintScriptDetails.validatorHash)
    ),
    0n,
    mintMintRoyaltyNFTRedeemer
  );

  // <-- mint royalty NFT
  txBuilder.mintPolicyTokensUnsafe(
    halPolicyHash,
    royaltyTokenValue,
    makeVoidData()
  );

  // <-- pay royalty NFT to royalty spend script address
  txBuilder.payUnsafe(
    royaltySpendScriptAddress,
    royaltyNFTValue,
    makeInlineTxOutputDatum(buildRoyaltyDatumData(royaltyDatum))
  );

  return Ok(txBuilder);
};

// /**
//  * @interface
//  * @typedef {object} UpdateRoyaltyParams
//  * @property {NetworkName} network Network
//  * @property {TxInput} royaltyTxInput Tx Input where Royalty Token is locked
//  * @property {RoyaltyDatum} newRoyaltyDatum Royalty Datum
//  * @property {DeployedScripts} deployedScripts Deployed Scripts
//  * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
//  */
// interface UpdateRoyaltyParams {
//   network: NetworkName;
//   royaltyTxInput: TxInput;
//   newRoyaltyDatum: RoyaltyDatum;
//   deployedScripts: DeployedScripts;
//   settingsAssetTxInput: TxInput;
// }

// /**
//  * @description Mint Royalty token
//  * @param {RequestParams} params
//  * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
//  */
// const updateRoyalty = async (
//   params: UpdateRoyaltyParams
// ): Promise<Result<TxBuilder, Error>> => {
//   const {
//     network,
//     royaltyTxInput,
//     newRoyaltyDatum,
//     deployedScripts,
//     settingsAssetTxInput,
//   } = params;
//   const isMainnet = network == "mainnet";

//   const { mintProxyScriptTxInput, mintScriptDetails, mintScriptTxInput } =
//     deployedScripts;

//   // decode settings
//   const settingsResult = mayFail(() =>
//     decodeSettingsDatum(settingsAssetTxInput.datum)
//   );
//   if (!settingsResult.ok) {
//     return Err(new Error(`Failed to decode settings: ${settingsResult.error}`));
//   }
//   const { data: settingsV1Data } = settingsResult.data;
//   const settingsV1Result = mayFail(() =>
//     decodeSettingsV1Data(settingsV1Data, network)
//   );
//   if (!settingsV1Result.ok) {
//     return Err(
//       new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
//     );
//   }
//   const { policy_id, allowed_minter, royalty_spend_script_address } =
//     settingsV1Result.data;

//   // hal policy id
//   const halPolicyHash = makeMintingPolicyHash(policy_id);
// };

export type { MintRoyaltyParams };
export { mintRoyalty };
