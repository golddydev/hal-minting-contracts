import { makeAssetClass, makeTxOutputId } from "@helios-lang/ledger";
import { Ok } from "ts-res";
import { assert, describe } from "vitest";

import { PREFIX_100, PREFIX_222 } from "../src/constants/index.js";
import {
  buildOrdersSpendCancelOrderRedeemer,
  cancel,
  decodeMintingDataDatum,
  fetchMintingData,
  fetchSettings,
  HalAssetInfo,
  invariant,
  mayFailTransaction,
  Order,
  prepareMintTransaction,
  request,
  rollBackOrdersFromTries,
  update,
} from "../src/index.js";
import { myTest } from "./setup.js";
import {
  balanceOfWallet,
  checkMintedAssets,
  logMemAndCpu,
  makeHalAssetDatum,
} from "./utils.js";

describe.sequential("Koralab H.A.L Tests", () => {
  // user_1 orders 3 new assets
  myTest(
    "user_1 orders 3 new assets",
    async ({ network, emulator, wallets, ordersTxInputs }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user1Wallet = usersWallets[0];
      const orders: Order[] = [[user1Wallet.address, 3]];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user1Wallet.address,
        await user1Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await user1Wallet.signTx(tx));
      const txId = await user1Wallet.submitTx(tx);
      emulator.tick(200);

      const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, 0));
      ordersTxInputs.push(orderTxInput);
    }
  );

  // cannot mint 3 new assets - <hal-1, hal-2, hal-3> as whitelisted
  myTest(
    "cannot mint 3 new assets - <hal-1, hal-2, hal-3> as whitelisted",
    async ({
      db,
      whitelistDB,
      network,
      wallets,
      ordersTxInputs,
      deployedScripts,
      whitelistMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-1", makeHalAssetDatum("hal-1")],
        ["hal-2", makeHalAssetDatum("hal-2")],
        ["hal-3", makeHalAssetDatum("hal-3")],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTime,
      });
      invariant(!txBuilderResult.ok, "Mint Tx Building should fail");
      assert(
        txBuilderResult.error.message.includes("not started yet for everyone")
      );

      const rollbackResult = await rollBackOrdersFromTries({
        utf8Names: assetsInfo.map((item) => item[0]),
        whitelistedItemsData: [],
        db,
        whitelistDB,
      });
      invariant(rollbackResult.ok, "Rollback failed");
    }
  );

  // mint 3 new assets - <hal-1, hal-2, hal-3>
  myTest(
    "mint 3 new assets - <hal-1, hal-2, hal-3>",
    async ({
      mockedFunctions,
      db,
      network,
      emulator,
      wallets,
      ordersTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-1", makeHalAssetDatum("hal-1")],
        ["hal-2", makeHalAssetDatum("hal-2")],
        ["hal-3", makeHalAssetDatum("hal-3")],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
      });
      invariant(txBuilderResult.ok, "Mint Tx Building Failed");

      const { txBuilder, userOutputsData, referenceOutputs } =
        txBuilderResult.data;
      txBuilder.addOutput(
        ...userOutputsData.map((item) => item.userOutput),
        ...referenceOutputs
      );

      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        paymentWallet.address,
        []
      ).complete();
      invariant(txResult.ok, "Mint Tx Complete Failed");
      logMemAndCpu(txResult);

      // set emulator time
      emulator.currentSlot = Math.ceil(normalMintingTime / 1000);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        ordersTxInputs,
        userOutputsData
      );

      // update minting data input
      const newMintingDataAssetTxInput = await emulator.getUtxo(
        makeTxOutputId(txId, 0)
      );
      const newMintingData = decodeMintingDataDatum(
        newMintingDataAssetTxInput.datum
      );
      mockedFunctions.mockedFetchMintingData.mockReturnValue(
        new Promise((resolve) =>
          resolve(
            Ok({
              mintingData: newMintingData,
              mintingDataAssetTxInput: newMintingDataAssetTxInput,
            })
          )
        )
      );

      // empty orders detail
      ordersTxInputs.length = 0;
    }
  );

  // // user_5 orders 5 new assets who is whitelisted
  // myTest(
  //   "user_5 orders 5 new assets who is whitelisted",
  //   async ({ network, emulator, wallets, ordersTxInputs }) => {
  //     invariant(
  //       Array.isArray(ordersTxInputs),
  //       "Orders tx inputs is not an array"
  //     );

  //     const { usersWallets } = wallets;
  //     const user5Wallet = usersWallets[4];
  //     const orders: Order[] = [[user5Wallet.address, 5]];

  //     const settingsResult = await fetchSettings(network);
  //     invariant(settingsResult.ok, "Settings Fetch Failed");
  //     const { settingsAssetTxInput } = settingsResult.data;

  //     const txBuilderResult = await request({
  //       network,
  //       orders,
  //       settingsAssetTxInput,
  //     });
  //     invariant(txBuilderResult.ok, "Order Tx Building failed");

  //     const txBuilder = txBuilderResult.data;
  //     const txResult = await mayFailTransaction(
  //       txBuilder,
  //       user5Wallet.address,
  //       await user5Wallet.utxos
  //     ).complete();
  //     invariant(txResult.ok, "Order Tx Complete failed");

  //     const { tx } = txResult.data;
  //     tx.addSignatures(await user5Wallet.signTx(tx));
  //     const txId = await user5Wallet.submitTx(tx);
  //     emulator.tick(200);

  //     const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, 0));
  //     ordersTxInputs.push(orderTxInput);
  //   }
  // );

  // // mint 5 new assets - <hal-4, hal-5, hal-6, hal-7, hal-8> as whitelisted
  // myTest(
  //   "mint 5 new assets - <hal-4, hal-5, hal-6, hal-7, hal-8> as whitelisted",
  //   async ({
  //     mockedFunctions,
  //     db,
  //     network,
  //     emulator,
  //     wallets,
  //     ordersTxInputs,
  //     deployedScripts,
  //     whitelistMintingTime,
  //   }) => {
  //     invariant(
  //       Array.isArray(ordersTxInputs),
  //       "Orders tx inputs is not an array"
  //     );

  //     const { allowedMinterWallet, paymentWallet } = wallets;

  //     const assetsInfo: HalAssetInfo[] = [
  //       ["hal-4", makeHalAssetDatum("hal-4")],
  //       ["hal-5", makeHalAssetDatum("hal-5")],
  //       ["hal-6", makeHalAssetDatum("hal-6")],
  //       ["hal-7", makeHalAssetDatum("hal-7")],
  //       ["hal-8", makeHalAssetDatum("hal-8")],
  //     ];

  //     const settingsResult = await fetchSettings(network);
  //     invariant(settingsResult.ok, "Settings Fetch Failed");
  //     const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
  //     const mintingDataResult = await fetchMintingData();
  //     invariant(mintingDataResult.ok, "Minting Data Fetch failed");
  //     const { mintingDataAssetTxInput } = mintingDataResult.data;

  //     const txBuilderResult = await prepareMintTransaction({
  //       network,
  //       address: allowedMinterWallet.address,
  //       ordersTxInputs,
  //       assetsInfo,
  //       db,
  //       deployedScripts,
  //       settingsAssetTxInput,
  //       mintingDataAssetTxInput,
  //       mintingTime: whitelistMintingTime,
  //     });
  //     invariant(txBuilderResult.ok, "Mint Tx Building Failed");

  //     const { txBuilder, userOutputsData, referenceOutputs } =
  //       txBuilderResult.data;
  //     txBuilder.addOutput(
  //       ...userOutputsData.map((item) => item.userOutput),
  //       ...referenceOutputs
  //     );

  //     txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
  //     const txResult = await mayFailTransaction(
  //       txBuilder,
  //       paymentWallet.address,
  //       []
  //     ).complete();
  //     invariant(txResult.ok, "Mint Tx Complete Failed");
  //     logMemAndCpu(txResult);

  //     // set emulator time
  //     emulator.currentSlot = Math.ceil(whitelistMintingTime / 1000);

  //     const { tx } = txResult.data;
  //     tx.addSignatures(await allowedMinterWallet.signTx(tx));
  //     const txId = await allowedMinterWallet.submitTx(tx);
  //     emulator.tick(200);

  //     // check minted assets
  //     await checkMintedAssets(
  //       network,
  //       emulator,
  //       settingsV1,
  //       ordersTxInputs,
  //       userOutputsData
  //     );

  //     // update minting data input
  //     const newMintingDataAssetTxInput = await emulator.getUtxo(
  //       makeTxOutputId(txId, 0)
  //     );
  //     const newMintingData = decodeMintingDataDatum(
  //       newMintingDataAssetTxInput.datum
  //     );
  //     mockedFunctions.mockedFetchMintingData.mockReturnValue(
  //       new Promise((resolve) =>
  //         resolve(
  //           Ok({
  //             mintingData: newMintingData,
  //             mintingDataAssetTxInput: newMintingDataAssetTxInput,
  //           })
  //         )
  //       )
  //     );

  //     // empty orders detail
  //     ordersTxInputs.length = 0;
  //   }
  // );

  // user_1 can update <hal-1> datum
  myTest(
    "user_1 can update <hal-1> datum",
    async ({ network, emulator, wallets, deployedScripts }) => {
      const { usersWallets, refSpendAdminWallet } = wallets;
      const user1Wallet = usersWallets[0];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsV1 } = settingsResult.data;
      const { policy_id, ref_spend_script_address } = settingsV1;
      const refUtxos = await emulator.getUtxos(ref_spend_script_address);

      const assetUtf8Name = "hal-1";
      const assetHexName = Buffer.from(assetUtf8Name).toString("hex");
      const refAssetName = `${PREFIX_100}${assetHexName}`;
      const userAssetName = `${PREFIX_222}${assetHexName}`;
      const foundRefUtxo = refUtxos.find((utxo) =>
        utxo.value.assets.hasAssetClass(
          makeAssetClass(`${policy_id}.${refAssetName}`)
        )
      );
      invariant(foundRefUtxo, "Reference Utxo Not Found");
      const userUtxos = await user1Wallet.utxos;
      const foundUserUtxo = userUtxos.find((utxo) =>
        utxo.value.assets.hasAssetClass(
          makeAssetClass(`${policy_id}.${userAssetName}`)
        )
      );
      invariant(foundUserUtxo, "User Utxo Not Found");

      const newDatum = makeHalAssetDatum("hal-1-updated");

      const txBuilderResult = await update({
        network,
        assetUtf8Name: "hal-1",
        newDatum,
        refTxInput: foundRefUtxo,
        userTxInput: foundUserUtxo,
        deployedScripts,
      });
      invariant(txBuilderResult.ok, "Update Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user1Wallet.address,
        userUtxos
      ).complete();
      invariant(txResult.ok, "Update Tx Complete failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures([
        ...(await refSpendAdminWallet.signTx(tx)),
        ...(await user1Wallet.signTx(tx)),
      ]);
      const txId = await user1Wallet.submitTx(tx);
      emulator.tick(200);

      const updatedUtxo = await emulator.getUtxo(makeTxOutputId(txId, 0));
      invariant(updatedUtxo.datum!.hash.toHex() === newDatum.hash.toHex());
    }
  );

  // user_2 orders 2 new assets 2 times
  myTest(
    "user_2 orders 2 new assets 2 times",
    async ({ network, emulator, wallets, ordersTxInputs }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];
      const orders: Order[] = [
        [user2Wallet.address, 2],
        [user2Wallet.address, 2],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user2Wallet.address,
        await user2Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await user2Wallet.signTx(tx));
      const txId = await user2Wallet.submitTx(tx);
      emulator.tick(200);

      for (let i = 0; i < 2; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        ordersTxInputs.push(orderTxInput);
      }
    }
  );

  // cannot mint 2 new assets because one asset name is not pre-defined in MPT - <hal-9, hal-10> and <hal-11, no-hal-12>
  myTest(
    "cannot mint 2 new assets because one asset name is not pre-defined in MPT - <hal-9, hal-10> and <hal-11, no-hal-12>",
    async ({
      network,
      db,
      whitelistDB,
      wallets,
      ordersTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-9", makeHalAssetDatum("hal-9")],
        ["hal-10", makeHalAssetDatum("hal-10")],
        ["hal-11", makeHalAssetDatum("hal-11")],
        ["no-hal-12", makeHalAssetDatum("no-hal-12")],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
      });
      invariant(!txResult.ok, "Mint Tx Building Should Fail");
      assert(txResult.error.message.includes("Asset name is not pre-defined"));

      // roll back
      const rollBackResult = await rollBackOrdersFromTries({
        utf8Names: assetsInfo.map(([utf8Name]) => utf8Name),
        whitelistedItemsData: [],
        db,
        whitelistDB,
      });
      invariant(rollBackResult.ok, "Roll Back Failed");
    }
  );

  // cannot cancel 2 orders in a transaction
  myTest(
    "cannot cancel 2 orders in a transaction",
    async ({ network, wallets, ordersTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];

      const txBuilderResult = await cancel({
        network,
        address: user2Wallet.address,
        orderTxInput: ordersTxInputs[0],
        deployedScripts,
      });
      invariant(txBuilderResult.ok, "Cancel Tx Building failed");

      // hack: cancel one other order also
      // without burning order token
      const txBuilder = txBuilderResult.data;
      txBuilder.spendUnsafe(
        ordersTxInputs[1],
        buildOrdersSpendCancelOrderRedeemer()
      );

      const txResult = await mayFailTransaction(
        txBuilder,
        user2Wallet.address,
        await user2Wallet.utxos
      ).complete();
      invariant(!txResult.ok, "Cancel Tx Complete should fail");
      assert(txResult.error.message.includes("expect own_utxo_count == 1"));
    }
  );

  // can cancel one order
  myTest(
    "can cancel one order",
    async ({ network, emulator, wallets, ordersTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];
      const beforeUser2Lovelace = (await balanceOfWallet(user2Wallet)).lovelace;

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsV1 } = settingsResult.data;
      const { hal_nft_price } = settingsV1;

      const txBuilderResult = await cancel({
        network,
        address: user2Wallet.address,
        orderTxInput: ordersTxInputs[1],
        deployedScripts,
      });
      invariant(txBuilderResult.ok, "Cancel Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user2Wallet.address,
        await user2Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Cancel Tx Complete failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await user2Wallet.signTx(tx));
      await user2Wallet.submitTx(tx);
      emulator.tick(200);

      const afterUser2Lovelace = (await balanceOfWallet(user2Wallet)).lovelace;

      invariant(
        afterUser2Lovelace - beforeUser2Lovelace > hal_nft_price - 1_000_000n,
        "User 2 Lovelace is not correct"
      );

      ordersTxInputs.splice(1, 1);
    }
  );

  // mint 2 new assets - <hal-9, hal-10>
  myTest(
    "mint 2 new assets - <hal-9, hal-10>",
    async ({
      mockedFunctions,
      db,
      network,
      emulator,
      wallets,
      ordersTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-9", makeHalAssetDatum("hal-9")],
        ["hal-10", makeHalAssetDatum("hal-10")],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
      });
      invariant(txBuilderResult.ok, "Mint Tx Building Failed");

      const { txBuilder, userOutputsData, referenceOutputs } =
        txBuilderResult.data;
      txBuilder.addOutput(
        ...userOutputsData.map((item) => item.userOutput),
        ...referenceOutputs
      );

      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        paymentWallet.address,
        []
      ).complete();
      invariant(txResult.ok, "Mint Tx Complete Failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        ordersTxInputs,
        userOutputsData
      );

      // update minting data input
      const newMintingDataAssetTxInput = await emulator.getUtxo(
        makeTxOutputId(txId, 0)
      );
      const newMintingData = decodeMintingDataDatum(
        newMintingDataAssetTxInput.datum
      );
      mockedFunctions.mockedFetchMintingData.mockReturnValue(
        new Promise((resolve) =>
          resolve(
            Ok({
              mintingData: newMintingData,
              mintingDataAssetTxInput: newMintingDataAssetTxInput,
            })
          )
        )
      );

      // empty orders detail
      ordersTxInputs.length = 0;
    }
  );

  // user_3 orders 5 new assets 3 times
  myTest(
    "user_3 orders 5 new assets 3 times",
    async ({ network, emulator, wallets, ordersTxInputs }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user3Wallet = usersWallets[2];
      const orders: Order[] = [
        [user3Wallet.address, 5],
        [user3Wallet.address, 5],
        [user3Wallet.address, 5],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user3Wallet.address,
        await user3Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await user3Wallet.signTx(tx));
      const txId = await user3Wallet.submitTx(tx);
      emulator.tick(200);

      for (let i = 0; i < 3; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        ordersTxInputs.push(orderTxInput);
      }
    }
  );

  // mint 15 new assets - <hal-101 ~ hal-115> - 1 user recieve 15 assets
  myTest(
    "mint 15 new assets - <hal-101 ~ hal-115> - 1 user recieve 15 assets",
    async ({
      mockedFunctions,
      db,
      network,
      emulator,
      wallets,
      ordersTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 15 },
        (_, index) => [
          `hal-${101 + index}`,
          makeHalAssetDatum(`hal-${101 + index}`),
        ]
      );

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
      });
      invariant(txBuilderResult.ok, "Mint Tx Building Failed");

      const { txBuilder, userOutputsData, referenceOutputs } =
        txBuilderResult.data;
      txBuilder.addOutput(
        ...userOutputsData.map((item) => item.userOutput),
        ...referenceOutputs
      );

      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        paymentWallet.address,
        []
      ).complete();
      invariant(txResult.ok, "Mint Tx Complete Failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      invariant(
        userOutputsData.length === 1,
        "User Outputs Data List Length is not correct"
      );

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        ordersTxInputs,
        userOutputsData
      );

      // update minting data input
      const newMintingDataAssetTxInput = await emulator.getUtxo(
        makeTxOutputId(txId, 0)
      );
      const newMintingData = decodeMintingDataDatum(
        newMintingDataAssetTxInput.datum
      );
      mockedFunctions.mockedFetchMintingData.mockReturnValue(
        new Promise((resolve) =>
          resolve(
            Ok({
              mintingData: newMintingData,
              mintingDataAssetTxInput: newMintingDataAssetTxInput,
            })
          )
        )
      );

      // empty orders detail
      ordersTxInputs.length = 0;
    }
  );

  // user_1, user_2, user_3 order 5 new assets
  myTest(
    "user_1, user_2, user_3 order 5 new assets",
    async ({ network, emulator, wallets, ordersTxInputs }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets, fundWallet } = wallets;
      const user1Wallet = usersWallets[0];
      const user2Wallet = usersWallets[1];
      const user3Wallet = usersWallets[2];
      const orders: Order[] = [
        [user1Wallet.address, 5],
        [user2Wallet.address, 5],
        [user3Wallet.address, 5],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        fundWallet.address,
        await fundWallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await fundWallet.signTx(tx));
      const txId = await fundWallet.submitTx(tx);
      emulator.tick(200);

      for (let i = 0; i < 3; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        ordersTxInputs.push(orderTxInput);
      }
    }
  );

  // mint 15 new assets - <hal-151 ~ hal-165> - 3 users recieve 5 assets each
  myTest(
    "mint 15 new assets - <hal-151 ~ hal-165> - 3 users recieve 5 assets each",
    async ({
      mockedFunctions,
      db,
      network,
      emulator,
      wallets,
      ordersTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(ordersTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 15 },
        (_, index) => [
          `hal-${151 + index}`,
          makeHalAssetDatum(`hal-${151 + index}`),
        ]
      );

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        ordersTxInputs,
        assetsInfo,
        db,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
      });
      invariant(txBuilderResult.ok, "Mint Tx Building Failed");

      const { txBuilder, userOutputsData, referenceOutputs } =
        txBuilderResult.data;
      txBuilder.addOutput(
        ...userOutputsData.map((item) => item.userOutput),
        ...referenceOutputs
      );

      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        paymentWallet.address,
        []
      ).complete();
      invariant(txResult.ok, "Mint Tx Complete Failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      invariant(
        userOutputsData.length === 3,
        "User Outputs Data List Length is not correct"
      );

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        ordersTxInputs,
        userOutputsData
      );

      // update minting data input
      const newMintingDataAssetTxInput = await emulator.getUtxo(
        makeTxOutputId(txId, 0)
      );
      const newMintingData = decodeMintingDataDatum(
        newMintingDataAssetTxInput.datum
      );
      mockedFunctions.mockedFetchMintingData.mockReturnValue(
        new Promise((resolve) =>
          resolve(
            Ok({
              mintingData: newMintingData,
              mintingDataAssetTxInput: newMintingDataAssetTxInput,
            })
          )
        )
      );

      // empty orders detail
      ordersTxInputs.length = 0;
    }
  );
});
