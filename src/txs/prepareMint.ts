import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import { ByteArrayLike, IntLike } from "@helios-lang/codec-utils";
import {
  Address,
  makeAddress,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeMintingPolicyHash,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeTxOutput,
  makeValidatorHash,
  makeValue,
  ShelleyAddress,
  TxInput,
  TxOutput,
} from "@helios-lang/ledger";
import { makeTxBuilder, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import {
  MPT_MINTED_VALUE,
  PREFIX_100,
  PREFIX_222,
} from "../constants/index.js";
import {
  AssetNameProof,
  buildMintingData,
  buildMintingDataMintRedeemer,
  buildMintMintNFTsRedeemer,
  buildOrdersSpendExecuteOrdersRedeemer,
  decodeMintingDataDatum,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  decodeWhitelistedValueFromCBOR,
  makeVoidData,
  makeWhitelistedItemData,
  makeWhitelistedValueData,
  MintingData,
  parseMPTProofJSON,
  Proofs,
  WhitelistedItem,
  WhitelistProof,
} from "../contracts/index.js";
import { convertError, mayFail } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";
import { AggregatedOrder, HalAssetInfo, HalUserOutputData } from "./types.js";
import { getWhitelistedKey, updateWhitelistedValue } from "./whitelist.js";
interface PrepareMintParams {
  isMainnet: boolean;
  address: Address;
  aggregatedOrders: AggregatedOrder[];
  assetsInfo: HalAssetInfo[];
  db: Trie;
  whitelistDB: Trie;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
  mintingDataAssetTxInput: TxInput;
  mintingTime: number;
}

/**
 * @description Prepare Mint Transaction
 * This function assumes all parameters are valid and do not need to validate again.
 * ## Before call this function:
 * - Filter out invalid Order UTxOs using `isOrderTxInputValid` function.
 * - Aggregate Order UTxOs using `aggregateOrderTxInputs` function.
 * ## NOTE:
 * - This function assumes that all Order UTxOs from aggregatedOrders are valid, otherwise it will return Error.
 * - Assets Info must be enough to mint all orders. (sum of `amount` from `aggregatedOrders`)
 * @param {PrepareMintParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const prepareMintTransaction = async (
  params: PrepareMintParams
): Promise<
  Result<
    {
      txBuilder: TxBuilder;
      db: Trie;
      whitelistDB: Trie;
      userOutputsData: HalUserOutputData[];
      referenceOutputs: TxOutput[];
    },
    Error
  >
> => {
  const {
    isMainnet,
    address,
    aggregatedOrders,
    assetsInfo: assetsInfoFromParam,
    db,
    whitelistDB,
    deployedScripts,
    settingsAssetTxInput,
    mintingDataAssetTxInput,
    mintingTime,
  } = params;

  // sort aggregated orders by destination address
  aggregatedOrders.sort((a, b) =>
    getWhitelistedKey(a.destinationAddress)
      .toString("hex")
      .localeCompare(getWhitelistedKey(b.destinationAddress).toString("hex"))
  );

  // destructure assetsInfo from param
  const assetsInfo = [...assetsInfoFromParam];

  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));

  const {
    mintProxyScriptTxInput,
    mintingDataScriptTxInput,
    mintScriptDetails,
    mintScriptTxInput,
    ordersSpendScriptTxInput,
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
    decodeSettingsV1Data(settingsV1Data, isMainnet)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const {
    policy_id,
    allowed_minter,
    ref_spend_proxy_script_hash,
    minting_start_time,
  } = settingsV1Result.data;

  // Get ref_spend_proxy script address where Ref Assets are collected.
  const refSpendProxyScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ref_spend_proxy_script_hash)
  );

  // hal policy id
  const halPolicyHash = makeMintingPolicyHash(policy_id);

  // decode minting data
  const mintingDataResult = mayFail(() =>
    decodeMintingDataDatum(mintingDataAssetTxInput.datum)
  );
  if (!mintingDataResult.ok) {
    return Err(
      new Error(`Failed to decode minting data: ${mintingDataResult.error}`)
    );
  }
  const mintingData = mintingDataResult.data;
  const { mpt_root_hash, whitelist_mpt_root_hash } = mintingData;

  // check if current db trie hash is same as minting data root hash
  if (
    mpt_root_hash.toLowerCase() !=
    (db.hash?.toString("hex") || Buffer.alloc(32).toString("hex")).toLowerCase()
  ) {
    return Err(new Error("ERROR: Local DB and On Chain Root Hash mismatch"));
  }

  // check if current whitelist db trie hash is same as minting data root hash
  if (
    whitelist_mpt_root_hash.toLowerCase() !=
    (
      whitelistDB.hash?.toString("hex") || Buffer.alloc(32).toString("hex")
    ).toLowerCase()
  ) {
    return Err(
      new Error(
        "ERROR: Local Whitelist DB and On Chain Whitelist Root Hash mismatch"
      )
    );
  }

  // make Proofs List for Minting Data V1 Redeemer
  // prepare H.A.L. NFTs value to mint
  const proofsList: Proofs[] = [];
  const userOutputsData: HalUserOutputData[] = [];
  const halTokensValue: [ByteArrayLike, IntLike][] = [];
  const referenceOutputs: TxOutput[] = [];

  const transactionTimeGap = minting_start_time - mintingTime;

  for (const aggregatedOrder of aggregatedOrders) {
    const assetNameProofs: AssetNameProof[] = [];
    const assetUtf8Names: string[] = [];
    let whitelistProof: WhitelistProof | undefined;
    const { destinationAddress, amount, needWhitelistProof } = aggregatedOrder;
    const userValue = makeValue(1n);

    for (let i = 0; i < amount; i++) {
      const assetInfo = assetsInfo.shift();
      if (!assetInfo) {
        return Err(new Error("Assets Info doesn't match with Orders' amount"));
      }
      const { assetUtf8Name, assetDatum } = assetInfo;
      const assetHexName = Buffer.from(assetUtf8Name, "utf8").toString("hex");
      assetUtf8Names.push(assetUtf8Name);

      try {
        const hasKey = typeof (await db.get(assetUtf8Name)) !== "undefined";
        if (!hasKey) {
          throw new Error(`Asset name is not pre-defined: ${assetUtf8Name}`);
        }

        const mptProof = await db.prove(assetUtf8Name);
        await db.delete(assetUtf8Name);
        await db.insert(assetUtf8Name, MPT_MINTED_VALUE);
        assetNameProofs.push([
          assetHexName,
          parseMPTProofJSON(mptProof.toJSON()),
        ]);
      } catch (error) {
        return Err(
          new Error(`Failed to make asset name proof: ${convertError(error)}`)
        );
      }

      const refAssetClass = makeAssetClass(
        halPolicyHash,
        `${PREFIX_100}${assetHexName}`
      );
      const userAssetClass = makeAssetClass(
        halPolicyHash,
        `${PREFIX_222}${assetHexName}`
      );

      // add user asset into one value.
      userValue.assets = userValue.assets.add(
        makeAssets([[userAssetClass, 1n]])
      );

      // make reference output value
      const refValue = makeValue(1n, makeAssets([[refAssetClass, 1n]]));

      // push reference output
      referenceOutputs.push(
        makeTxOutput(refSpendProxyScriptAddress, refValue, assetDatum)
      );

      // add hal token value to mint
      halTokensValue.push(
        [refAssetClass.tokenName, 1n],
        [userAssetClass.tokenName, 1n]
      );
    }

    if (needWhitelistProof) {
      // have to be whitelisted
      const destinationAddressKey = Buffer.from(
        destinationAddress.toUplcData().toCbor()
      );
      try {
        const whitelistedValueCbor = await whitelistDB.get(
          destinationAddressKey
        );
        if (!whitelistedValueCbor) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} is not whitelisted. Wait until ${new Date(
                minting_start_time
              ).toLocaleString()}`
            )
          );
        }

        const whitelistedValueResult =
          decodeWhitelistedValueFromCBOR(whitelistedValueCbor);
        if (!whitelistedValueResult.ok) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} has invalid whitelisted item data in Trie: ${
                whitelistedValueResult.error
              }`
            )
          );
        }
        const whitelistedValue = whitelistedValueResult.data;
        const { newWhitelistedValue } = updateWhitelistedValue(
          whitelistedValue,
          amount,
          transactionTimeGap
        );

        // then make proof
        const proof = await whitelistDB.prove(destinationAddressKey);
        whitelistProof = [whitelistedValue, parseMPTProofJSON(proof.toJSON())];
        const updatedWhitelistedValueCbor = Buffer.from(
          makeWhitelistedValueData(newWhitelistedValue).toCbor()
        );

        // update whitelist DB
        await whitelistDB.delete(destinationAddressKey);
        await whitelistDB.insert(
          destinationAddressKey,
          updatedWhitelistedValueCbor
        );
      } catch (error) {
        return Err(
          new Error(
            `Failed to make whitelist proof for ${destinationAddress.toBech32()}: ${convertError(
              error
            )}`
          )
        );
      }
    }

    proofsList.push([assetNameProofs, whitelistProof]);
    userOutputsData.push({
      assetUtf8Names,
      destinationAddress,
      userOutput: makeTxOutput(destinationAddress, userValue),
    });
  }

  // update minting data
  const newMintingData: MintingData = {
    ...mintingData,
    mpt_root_hash: (
      db.hash?.toString("hex") || Buffer.alloc(32).toString("hex")
    ).toLowerCase(),
    whitelist_mpt_root_hash: (
      whitelistDB.hash?.toString("hex") || Buffer.alloc(32).toString("hex")
    ).toLowerCase(),
  };

  // minting data asset value
  const mintingDataValue = makeValue(
    mintingDataAssetTxInput.value.lovelace,
    mintingDataAssetTxInput.value.assets
  );

  // build redeemer for mint v1 `MintNFTs`
  const mintMintNFTsRedeemer = buildMintMintNFTsRedeemer();

  // build redeemer for minting data `Mint(proofsList)`
  const mintingDataMintRedeemer = buildMintingDataMintRedeemer(proofsList);

  // build redeemer for orders spend `ExecuteOrders`
  const ordersSpendExecuteOrdersRedeemer =
    buildOrdersSpendExecuteOrdersRedeemer();

  const totalOrderTxInputs = aggregatedOrders
    .map((aggregatedOrder) => aggregatedOrder.orderTxInputs)
    .flat();

  // start building tx
  const txBuilder = makeTxBuilder({
    isMainnet,
  });

  // <-- add required signer
  txBuilder.addSigners(makePubKeyHash(allowed_minter));

  // <-- attach settings asset as reference input
  txBuilder.refer(settingsAssetTxInput);

  // <-- attach deployed scripts
  txBuilder.refer(
    mintProxyScriptTxInput,
    mintScriptTxInput,
    mintingDataScriptTxInput,
    ordersSpendScriptTxInput
  );

  // <-- withdraw from mint withdrawal validator (script from reference input)
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(mintScriptDetails.validatorHash)
    ),
    0n,
    mintMintNFTsRedeemer
  );

  // <-- start from minting time
  txBuilder.validFromTime(mintingTime);

  // <-- spend minting data utxo
  txBuilder.spendUnsafe(mintingDataAssetTxInput, mintingDataMintRedeemer);

  // <-- lock minting data value with new root hash - mintint_data_output
  txBuilder.payUnsafe(
    mintingDataAssetTxInput.address,
    mintingDataValue,
    makeInlineTxOutputDatum(buildMintingData(newMintingData))
  );

  // <-- mint hal nfts
  txBuilder.mintPolicyTokensUnsafe(
    halPolicyHash,
    halTokensValue,
    makeVoidData()
  );

  // <-- spend order utxos
  for (const orderTxInput of totalOrderTxInputs) {
    txBuilder.spendUnsafe(orderTxInput, ordersSpendExecuteOrdersRedeemer);
  }

  return Ok({
    txBuilder,
    db,
    whitelistDB,
    userOutputsData,
    referenceOutputs,
  });
};

/**
 * @interface
 * @typedef {object} RollBackOrdersFromTriesParams
 * @property {string[]} utf8Names H.A.L. Assets' UTF-8 Names
 * @property {Array<{address: ShelleyAddress; whitelistedItem: WhitelistedItem;}>} whitelistedItemsData Original Whitelisted Items Data that may be changed
 * @property {Trie} db Trie DB
 */
interface RollBackOrdersFromTriesParams {
  utf8Names: string[];
  whitelistedItemsData: Array<{
    address: ShelleyAddress;
    whitelistedItem: WhitelistedItem;
  }>;
  db: Trie;
  whitelistDB: Trie;
}

/**
 * @description Roll Back Orders from Trie after minting is failed
 * @param {RollBackOrdersFromTriesParams} params
 * @returns {Promise<Result<void,  Error>>} Result or Error
 */
const rollBackOrdersFromTries = async (
  params: RollBackOrdersFromTriesParams
): Promise<Result<void, Error>> => {
  const { utf8Names, whitelistedItemsData, db, whitelistDB } = params;

  for (const utf8Name of utf8Names) {
    try {
      const value = await db.get(utf8Name);
      const needRollback =
        typeof value !== "undefined" &&
        Buffer.from(value).toString() === MPT_MINTED_VALUE;
      if (needRollback) {
        await db.delete(utf8Name);
        await db.insert(utf8Name, "");
      }
    } catch (error) {
      return Err(
        new Error(`Failed to roll back "${utf8Name}" : ${convertError(error)}`)
      );
    }
  }

  for (const whitelistedItemData of whitelistedItemsData) {
    const { address, whitelistedItem } = whitelistedItemData;
    const key = Buffer.from(address.toUplcData().toCbor());
    const value = Buffer.from(
      makeWhitelistedItemData(whitelistedItem).toCbor()
    );
    const currentValue = await whitelistDB.get(key);
    if (
      currentValue &&
      currentValue.toString("hex") !== value.toString("hex")
    ) {
      await whitelistDB.delete(key);
      await whitelistDB.insert(key, value);
    }
  }

  return Ok();
};

export type { PrepareMintParams, RollBackOrdersFromTriesParams };
export { prepareMintTransaction, rollBackOrdersFromTries };
