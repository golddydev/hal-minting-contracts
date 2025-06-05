import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import { ByteArrayLike, IntLike } from "@helios-lang/codec-utils";
import {
  Address,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeMintingPolicyHash,
  makePubKeyHash,
  makeStakingAddress,
  makeStakingValidatorHash,
  makeTxOutput,
  makeValue,
  ShelleyAddress,
  TxInput,
  TxOutput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import {
  MPT_MINTED_VALUE,
  ORDER_ASSET_HEX_NAME,
  PREFIX_100,
  PREFIX_222,
} from "../constants/index.js";
import {
  buildMintingData,
  buildMintingDataMintRedeemer,
  buildMintV1MintHandlesRedeemer,
  buildOrdersSpendExecuteOrdersRedeemer,
  decodeMintingDataDatum,
  decodeOrderDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  makeVoidData,
  MintingData,
  Order,
  parseMPTProofJSON,
  Proofs,
} from "../contracts/index.js";
import { convertError, mayFail } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";
import { HalAssetInfo, HalOutputsData } from "./types.js";

/**
 * @interface
 * @typedef {object} PrepareMintParams
 * @property {NetworkName} network Network
 * @property {Address} address Wallet Address to perform mint
 * @property {TxInput[]} ordersTxInputs Orders UTxOs
 * @property {HalAssetInfo[]} assetsInfo H.A.L. Assets' Info
 * @property {Trie} db Trie DB
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 * @property {TxInput} mintingDataAssetTxInput Minting Data UTxO
 */
interface PrepareMintParams {
  network: NetworkName;
  address: Address;
  ordersTxInputs: TxInput[];
  assetsInfo: HalAssetInfo[];
  db: Trie;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
  mintingDataAssetTxInput: TxInput;
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
      db: Trie;
      halOutputsDataList: HalOutputsData[];
    },
    Error
  >
> => {
  const {
    network,
    address,
    ordersTxInputs,
    assetsInfo: assetsInfoFromParam,
    db,
    deployedScripts,
    settingsAssetTxInput,
    mintingDataAssetTxInput,
  } = params;
  const assetsInfo = [...assetsInfoFromParam];
  const isMainnet = network == "mainnet";
  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));

  console.log(`${ordersTxInputs.length} Orders are picked`);

  // aggregate orders information
  const aggregatedOrdersResult = aggregateOrdersInformation({
    network,
    ordersTxInputs,
  });
  if (!aggregatedOrdersResult.ok) {
    return Err(
      new Error(`Failed to aggregate orders: ${aggregatedOrdersResult.error}`)
    );
  }
  const aggregatedOrders = aggregatedOrdersResult.data;

  const {
    mintProxyScriptTxInput,
    mintingDataScriptTxInput,
    mintV1ScriptDetails,
    mintV1ScriptTxInput,
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
    decodeSettingsV1Data(settingsV1Data, network)
  );
  if (!settingsV1Result.ok) {
    return Err(
      new Error(`Failed to decode settings v1: ${settingsV1Result.error}`)
    );
  }
  const {
    policy_id,
    allowed_minter,
    payment_address,
    orders_mint_policy_id,
    ref_spend_script_address,
  } = settingsV1Result.data;

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

  // check if current db trie hash is same as minting data root hash
  if (
    mintingData.mpt_root_hash.toLowerCase() !=
    (db.hash?.toString("hex") || Buffer.alloc(32).toString("hex")).toLowerCase()
  ) {
    return Err(new Error("ERROR: Local DB and On Chain Root Hash mismatch"));
  }

  // make Proofs List for Minting Data V1 Redeemer
  // prepare H.A.L. NFTs value to mint
  const proofsList: Proofs[] = [];
  const mintingHalsData = [];
  const halTokenValue: [ByteArrayLike, IntLike][] = [];

  for (const aggregatedOrder of aggregatedOrders) {
    const proofs: Proofs = [];
    const refOutputsData = [];
    const userValue = makeValue(1n);
    const assetUtf8Names: string[] = [];
    const [destinationAddress, amount] = aggregatedOrder;

    for (let i = 0; i < amount; i++) {
      const assetInfo = assetsInfo.shift();
      if (!assetInfo) {
        return Err(new Error("Assets Info doesn't match with Orders' amount"));
      }
      const [assetUtf8Name, assetDatum] = assetInfo;
      const assetHexName = Buffer.from(assetUtf8Name, "utf8").toString("hex");
      assetUtf8Names.push(assetUtf8Name);

      try {
        const hasKey = typeof (await db.get(assetUtf8Name)) !== "undefined";
        if (!hasKey) {
          throw new Error(`Asset name is not pre-defined: ${assetUtf8Name}`);
        }

        const mpfProof = await db.prove(assetUtf8Name);
        await db.delete(assetUtf8Name);
        await db.insert(assetUtf8Name, MPT_MINTED_VALUE);
        proofs.push([assetHexName, parseMPTProofJSON(mpfProof.toJSON())]);
      } catch (error) {
        return Err(new Error(convertError(error)));
      }

      const refAssetClass = makeAssetClass(
        halPolicyHash,
        `${PREFIX_100}${assetHexName}`
      );
      const userAssetClass = makeAssetClass(
        halPolicyHash,
        `${PREFIX_222}${assetHexName}`
      );

      const refValue = makeValue(1n, makeAssets([[refAssetClass, 1n]]));
      // add user asset into one value.
      userValue.assets = userValue.assets.add(
        makeAssets([[userAssetClass, 1n]])
      );

      refOutputsData.push({
        assetDatum,
        refValue,
      });

      halTokenValue.push(
        [refAssetClass.tokenName, 1n],
        [userAssetClass.tokenName, 1n]
      );
    }

    proofsList.push(proofs);
    mintingHalsData.push({
      assetUtf8Names,
      destinationAddress,
      refOutputsData,
      userValue,
    });
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

  // build redeemer for minting data `Mint(proofsList)`
  const mintingDataMintRedeemer = buildMintingDataMintRedeemer(proofsList);

  // prepare order tokens value to collect
  const ordersMintPolicyHash = makeMintingPolicyHash(orders_mint_policy_id);
  const orderTokenAssetClass = makeAssetClass(
    ordersMintPolicyHash,
    ORDER_ASSET_HEX_NAME
  );
  const orderTokensValue = makeValue(
    1n,
    makeAssets([[orderTokenAssetClass, BigInt(ordersTxInputs.length)]])
  );

  // build redeemer for orders spend `ExecuteOrders`
  const ordersSpendExecuteOrdersRedeemer =
    buildOrdersSpendExecuteOrdersRedeemer();

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
    ordersSpendScriptTxInput
  );

  // <-- withdraw from mint v1 withdrawal validator (script from reference input)
  txBuilder.withdrawUnsafe(
    makeStakingAddress(
      isMainnet,
      makeStakingValidatorHash(mintV1ScriptDetails.validatorHash)
    ),
    0n,
    mintV1MintHandlesRedeemer
  );

  // <-- spend minting data utxo
  txBuilder.spendUnsafe(mintingDataAssetTxInput, mintingDataMintRedeemer);

  // <-- lock minting data value with new root hash - mintint_data_output
  txBuilder.payUnsafe(
    mintingDataAssetTxInput.address,
    mintingDataValue,
    makeInlineTxOutputDatum(buildMintingData(newMintingData))
  );

  // <-- collect order nfts to order_nfts_output
  txBuilder.payUnsafe(payment_address, orderTokensValue);

  // <-- mint hal nfts
  txBuilder.mintPolicyTokensUnsafe(
    halPolicyHash,
    halTokenValue,
    makeVoidData()
  );

  // <-- spend order utxos
  for (const orderTxInput of ordersTxInputs) {
    txBuilder.spendUnsafe(orderTxInput, ordersSpendExecuteOrdersRedeemer);
  }

  const halOutputsDataList: HalOutputsData[] = [];

  // prepare hal outputs to use it after this function call
  for (const mintingHalData of mintingHalsData) {
    const { destinationAddress, refOutputsData, userValue, assetUtf8Names } =
      mintingHalData;
    const refOutputs: TxOutput[] = [];

    // make ref outputs
    for (const refOutputData of refOutputsData) {
      const { refValue, assetDatum } = refOutputData;
      refOutputs.push(
        makeTxOutput(ref_spend_script_address, refValue, assetDatum)
      );
    }

    // make user outputs
    const userOutput = makeTxOutput(destinationAddress, userValue);

    halOutputsDataList.push({
      refOutputs,
      userOutput,
      assetUtf8Names,
    });
  }

  return Ok({
    txBuilder,
    db,
    halOutputsDataList,
  });
};

/**
 * @interface
 * @typedef {object} RollBackOrdersFromTrieParams
 * @property {string[]} utf8Names H.A.L. Assets' UTF-8 Names
 * @property {Trie} db Trie DB
 */
interface RollBackOrdersFromTrieParams {
  utf8Names: string[];
  db: Trie;
}

/**
 * @description Roll Back Orders from Trie after minting is failed
 * @param {RollBackOrdersFromTrieParams} params
 * @returns {Promise<Result<void,  Error>>} Result or Error
 */
const rollBackOrdersFromTrie = async (
  params: RollBackOrdersFromTrieParams
): Promise<Result<void, Error>> => {
  const { utf8Names, db } = params;

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
  return Ok();
};

/**
 * @interface
 * @typedef {object} AggregateOrdersInformationParams
 * @property {NetworkName} network Network
 * @property {Order[]} ordersTxInputs Orders UTxOs
 */
interface AggregateOrdersInformationParams {
  network: NetworkName;
  ordersTxInputs: TxInput[];
}

/**
 * @description Aggregate Orders Tx Inputs Information and sort Tx Inputs
 * @param {AggregateOrdersInformationParams} params
 * @returns {Result<Order[],  Error>} Result or Error
 */
const aggregateOrdersInformation = (
  params: AggregateOrdersInformationParams
): Result<Order[], Error> => {
  const { network, ordersTxInputs } = params;
  let aggregatedOrders: Order[] = [];

  // refactor Orders Tx Inputs
  // NOTE:
  // sort orderUtxos before process
  // because tx inputs is sorted lexicographically
  ordersTxInputs.sort((a, b) => (a.id.toString() > b.id.toString() ? 1 : -1));

  for (const orderTxInput of ordersTxInputs) {
    const decodedResult = mayFail(() =>
      decodeOrderDatumData(orderTxInput.datum, network)
    );
    if (!decodedResult.ok) {
      return Err(new Error(`Invalid Order Datum: ${decodedResult.error}`));
    }
    const { destination_address, amount, price } = decodedResult.data;

    // check lovelace is enough
    if (orderTxInput.output.value.lovelace < price * BigInt(amount)) {
      return Err(
        new Error(
          `Order UTxO "${orderTxInput.id.toString()}" has insufficient lovelace`
        )
      );
    }

    aggregatedOrders = addOrderToAggregatedOrders(
      aggregatedOrders,
      destination_address,
      amount
    );
  }

  return Ok(aggregatedOrders);
};

const addOrderToAggregatedOrders = (
  aggregatedOrders: Order[],
  address: ShelleyAddress,
  amount: number
) => {
  const newAggregatedOrders: Order[] = [];

  let added: boolean = false;
  for (const aggregatedOrder of aggregatedOrders) {
    const [aggregatedAddress, aggregatedAmount] = aggregatedOrder;
    if (address.toHex() === aggregatedAddress.toHex()) {
      added = true;
      newAggregatedOrders.push([address, aggregatedAmount + amount]);
    } else {
      newAggregatedOrders.push(aggregatedOrder);
    }
  }
  if (!added) {
    newAggregatedOrders.push([address, amount]);
  }

  return newAggregatedOrders;
};

export type {
  AggregateOrdersInformationParams,
  PrepareMintParams,
  RollBackOrdersFromTrieParams,
};
export {
  aggregateOrdersInformation,
  prepareMintTransaction,
  rollBackOrdersFromTrie,
};
