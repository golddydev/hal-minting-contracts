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
  PREFIX_100,
  PREFIX_222,
} from "../constants/index.js";
import {
  AssetNameProof,
  buildMintingData,
  buildMintingDataMintRedeemer,
  buildMintV1MintNFTsRedeemer,
  buildOrdersSpendExecuteOrdersRedeemer,
  decodeMintingDataDatum,
  decodeOrderDatumData,
  decodeSettingsDatum,
  decodeSettingsV1Data,
  decodeWhitelistedItem,
  makeVoidData,
  makeWhitelistedItemData,
  MintingData,
  Order,
  parseMPTProofJSON,
  Proofs,
  WhitelistedItem,
  WhitelistProof,
} from "../contracts/index.js";
import { convertError, mayFail } from "../helpers/index.js";
import { DeployedScripts } from "./deploy.js";
import { HalAssetInfo, HalUserOutputData } from "./types.js";

/**
 * @interface
 * @typedef {object} PrepareMintParams
 * @property {NetworkName} network Network
 * @property {Address} address Wallet Address to perform mint
 * @property {TxInput[]} ordersTxInputs Orders UTxOs
 * @property {HalAssetInfo[]} assetsInfo H.A.L. Assets' Info
 * @property {Trie} db Trie DB
 * @property {Trie} whitelistDB Whitelist DB
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 * @property {TxInput} settingsAssetTxInput Settings Reference UTxO
 * @property {TxInput} mintingDataAssetTxInput Minting Data UTxO
 * @property {number | undefined} mintingTime After when this transaction is valid from
 */
interface PrepareMintParams {
  network: NetworkName;
  address: Address;
  ordersTxInputs: TxInput[];
  assetsInfo: HalAssetInfo[];
  db: Trie;
  whitelistDB: Trie;
  deployedScripts: DeployedScripts;
  settingsAssetTxInput: TxInput;
  mintingDataAssetTxInput: TxInput;
  mintingTime?: number | undefined;
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
      userOutputsData: HalUserOutputData[];
      referenceOutputs: TxOutput[];
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
    whitelistDB,
    deployedScripts,
    settingsAssetTxInput,
    mintingDataAssetTxInput,
    mintingTime = Date.now(),
  } = params;
  const assetsInfo = [...assetsInfoFromParam];
  const isMainnet = network == "mainnet";
  if (address.era == "Byron")
    return Err(new Error("Byron Address not supported"));

  console.log(`${ordersTxInputs.length} Orders are picked`);

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
    hal_nft_price,
    ref_spend_script_address,
    minting_start_time,
  } = settingsV1Result.data;

  // aggregate orders information
  const aggregatedOrdersResult = aggregateOrdersInformation({
    network,
    ordersTxInputs,
    halNftPrice: hal_nft_price,
  });
  if (!aggregatedOrdersResult.ok) {
    return Err(
      new Error(`Failed to aggregate orders: ${aggregatedOrdersResult.error}`)
    );
  }
  const aggregatedOrders = aggregatedOrdersResult.data;

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
  const halTokenValue: [ByteArrayLike, IntLike][] = [];
  const referenceOutputs: TxOutput[] = [];

  for (const aggregatedOrder of aggregatedOrders) {
    const assetNameProofs: AssetNameProof[] = [];
    const assetUtf8Names: string[] = [];
    let whitelistProof: WhitelistProof | undefined;
    const [destinationAddress, amount] = aggregatedOrder;
    const userValue = makeValue(1n);

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
        assetNameProofs.push([
          assetHexName,
          parseMPTProofJSON(mpfProof.toJSON()),
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
        makeTxOutput(ref_spend_script_address, refValue, assetDatum)
      );

      // add hal token value to mint
      halTokenValue.push(
        [refAssetClass.tokenName, 1n],
        [userAssetClass.tokenName, 1n]
      );
    }

    // chekc minting time
    if (mintingTime < minting_start_time) {
      // have to be whitelisted
      const destinationAddressKey = Buffer.from(
        destinationAddress.toUplcData().toCbor()
      );
      try {
        const whitelistedItemValue = await whitelistDB.get(
          destinationAddressKey
        );
        if (!whitelistedItemValue) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} is not whitelisted. Wait until ${new Date(
                minting_start_time
              ).toLocaleString()}`
            )
          );
        }

        const whitelistedItemResult =
          decodeWhitelistedItem(whitelistedItemValue);
        if (!whitelistedItemResult.ok) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} has invalid whitelisted item data in Trie: ${
                whitelistedItemResult.error
              }`
            )
          );
        }
        const [time_gap, whitelisted_amount] = whitelistedItemResult.data;
        const whitelistedTime = minting_start_time - time_gap;
        if (mintingTime < whitelistedTime) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} is whitelisted but couldn't mint yet. Wait until ${new Date(
                whitelistedTime
              ).toLocaleString()}`
            )
          );
        }
        if (amount > whitelisted_amount) {
          return Err(
            new Error(
              `Address ${destinationAddress.toBech32()} has ${whitelisted_amount} whitelisted amount but order amount is ${amount}`
            )
          );
        }

        // then make proof
        const proof = await whitelistDB.prove(destinationAddressKey);
        whitelistProof = [
          whitelistedItemResult.data,
          parseMPTProofJSON(proof.toJSON()),
        ];

        // update whitelisted item
        const newWhitelistedItem: WhitelistedItem = [
          time_gap,
          whitelisted_amount - amount,
        ];
        const newWhitelistedItemValue = Buffer.from(
          makeWhitelistedItemData(newWhitelistedItem).toCbor()
        );

        // update whitelist DB
        await whitelistDB.delete(destinationAddressKey);
        await whitelistDB.insert(
          destinationAddressKey,
          newWhitelistedItemValue
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

  // update all handles in minting data
  // update whitelist data
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
  const mintingDataValue = makeValue(1n, mintingDataAssetTxInput.value.assets);

  // build redeemer for mint v1 `MintNFTs`
  const mintV1MintNFTsRedeemer = buildMintV1MintNFTsRedeemer();

  // build redeemer for minting data `Mint(proofsList)`
  const mintingDataMintRedeemer = buildMintingDataMintRedeemer(proofsList);

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
    mintV1MintNFTsRedeemer
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
    halTokenValue,
    makeVoidData()
  );

  // <-- spend order utxos
  for (const orderTxInput of ordersTxInputs) {
    txBuilder.spendUnsafe(orderTxInput, ordersSpendExecuteOrdersRedeemer);
  }

  return Ok({
    txBuilder,
    db,
    userOutputsData,
    referenceOutputs,
  });
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
  halNftPrice: bigint;
}

/**
 * @description Aggregate Orders Tx Inputs Information and sort Tx Inputs
 * @param {AggregateOrdersInformationParams} params
 * @returns {Result<Order[],  Error>} Result or Error
 */
const aggregateOrdersInformation = (
  params: AggregateOrdersInformationParams
): Result<Order[], Error> => {
  const { network, ordersTxInputs, halNftPrice } = params;
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
    const { destination_address, amount } = decodedResult.data;

    // check lovelace is enough
    if (orderTxInput.output.value.lovelace < halNftPrice * BigInt(amount)) {
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

export type {
  AggregateOrdersInformationParams,
  PrepareMintParams,
  RollBackOrdersFromTriesParams,
};
export {
  aggregateOrdersInformation,
  prepareMintTransaction,
  rollBackOrdersFromTries,
};
