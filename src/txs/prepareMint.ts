import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import {
  Address,
  makeInlineTxOutputDatum,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeValue,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { fetchMintingData, fetchSettings } from "../configs/index.js";
import { MPT_MINTED_VALUE } from "../constants/index.js";
import {
  buildMintingData,
  buildMintingDataMintRedeemer,
  buildMintV1MintHandlesRedeemer,
  makeVoidData,
  MintingData,
  parseMPTProofJSON,
  Proof,
  Settings,
  SettingsV1,
} from "../contracts/index.js";
import { DeployedScripts } from "./deploy.js";
import { OrderedAsset } from "./types.js";

/**
 * @interface
 * @typedef {object} PrepareMintParams
 * @property {NetworkName} network Network
 * @property {Address} address Wallet Address to perform mint
 * @property {OrderedAsset[]} orderedAssets Ordered Assets Information
 * @property {Trie} db Trie DB
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 */
interface PrepareMintParams {
  network: NetworkName;
  address: Address;
  orderedAssets: OrderedAsset[];
  db: Trie;
  deployedScripts: DeployedScripts;
}

/**
 * @description Mint New Handles from Order
 * @param {PrepareMintParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const prepareMintTransaction = async (
  params: PrepareMintParams
): Promise<
  Result<
    {
      txBuilder: TxBuilder;
      settings: Settings;
      settingsV1: SettingsV1;
    },
    Error
  >
> => {
  const { network, address, orderedAssets, db, deployedScripts } = params;
  const isMainnet = network == "mainnet";
  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));

  const {
    mintProxyScriptTxInput,
    mintingDataScriptTxInput,
    mintV1ScriptDetails,
    mintV1ScriptTxInput,
    ordersMintScriptTxInput,
    ordersSpendScriptTxInput,
  } = deployedScripts;

  // fetch settings
  const settingsResult = await fetchSettings(network);
  if (!settingsResult.ok)
    return Err(new Error(`Failed to fetch settings: ${settingsResult.error}`));
  const { settings, settingsV1, settingsAssetTxInput } = settingsResult.data;
  const { hal_nft_price, allowed_minter, payment_address } = settingsV1;

  const mintingDataResult = await fetchMintingData();
  if (!mintingDataResult.ok)
    return Err(
      new Error(`Failed to fetch minting data: ${mintingDataResult.error}`)
    );
  const { mintingData, mintingDataAssetTxInput } = mintingDataResult.data;

  // check if current db trie hash is same as minting data root hash
  if (
    mintingData.mpt_root_hash.toLowerCase() !=
    (db.hash?.toString("hex") || Buffer.alloc(32).toString("hex")).toLowerCase()
  ) {
    return Err(new Error("ERROR: Local DB and On Chain Root Hash mismatch"));
  }

  // make Proofs for Minting Data V1 Redeemer
  const proofs: Proof[] = [];
  for (const orderedAsset of orderedAssets) {
    const { utf8Name, hexName } = orderedAsset;

    try {
      // NOTE:
      // Have to remove handles if transaction fails
      const mpfProof = await db.prove(utf8Name);
      await db.delete(utf8Name);
      await db.insert(utf8Name, MPT_MINTED_VALUE);
      proofs.push({
        mpt_proof: parseMPTProofJSON(mpfProof.toJSON()),
        asset_name: hexName,
      });
    } catch (e) {
      console.warn("Asset name is not pre-defined", utf8Name, e);
      return Err(new Error(`Asset name is not pre-defined: ${utf8Name}`));
    }
  }

  // update all handles in minting data
  const newMintingData: MintingData = {
    ...mintingData,
    mpt_root_hash: db.hash.toString("hex"),
  };

  // minting data asset value
  const mintingDataValue = makeValue(
    mintingDataAssetTxInput.value.lovelace,
    mintingDataAssetTxInput.value.assets
  );

  // build redeemer for mint v1 `MintNFTs`
  const mintV1MintHandlesRedeemer = buildMintV1MintHandlesRedeemer();

  // build redeemer for minting data `Mint(Proofs)`
  const mintingDataMintRedeemer = buildMintingDataMintRedeemer(proofs);

  // calculate total price
  const totalPrice = hal_nft_price * BigInt(orderedAssets.length);

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- add required signer
  txBuilder.addSigners(makePubKeyHash(allowed_minter));

  // <-- attach settings asset as reference input
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach deploy scripts
  txBuilder.refer(
    mintProxyScriptTxInput,
    mintV1ScriptTxInput,
    mintingDataScriptTxInput,
    ordersMintScriptTxInput,
    ordersSpendScriptTxInput
  );

  // <-- spend minting data utxo
  txBuilder.spendUnsafe(mintingDataAssetTxInput, mintingDataMintRedeemer);

  // <-- lock minting data value with new root hash
  txBuilder.payUnsafe(
    mintingDataAssetTxInput.address,
    mintingDataValue,
    makeInlineTxOutputDatum(buildMintingData(newMintingData))
  );

  // <-- withdraw from mint v1 withdraw validator (script from reference input)
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(mintV1ScriptDetails.validatorHash)
    ),
    0n,
    mintV1MintHandlesRedeemer
  );

  // <-- pay hal nft price to payment address
  txBuilder.payUnsafe(
    payment_address,
    makeValue(totalPrice),
    makeInlineTxOutputDatum(makeVoidData())
  );

  // NOTE:
  // After call this function
  // using txBuilder (returned value)
  // they have to continue with minting assets (ref and user assets)
  // and sending them to correct addresses (to cip68 script address and destination addresses)

  return Ok({
    txBuilder,
    settings,
    settingsV1,
  });
};

export type { PrepareMintParams };
export { prepareMintTransaction };
