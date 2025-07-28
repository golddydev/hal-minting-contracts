import {
  makeAddress,
  makeAssetClass,
  makeInlineTxOutputDatum,
  makeTxOutputId,
  makeValidatorHash,
} from "@helios-lang/ledger";
import { Ok } from "ts-res";
import { assert, describe } from "vitest";

import { PREFIX_100, PREFIX_222 } from "../src/constants/index.js";
import {
  buildOrdersSpendCancelOrderRedeemer,
  buildOrdersSpendRefundOrderRedeemer,
  cancel,
  decodeMintingDataDatum,
  fetchMintingData,
  fetchSettings,
  HalAssetInfo,
  invariant,
  makeVoidData,
  mayFailTransaction,
  Order,
  prepareMintTransaction,
  refund,
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
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user1Wallet = usersWallets[0];
      const orders: Order[] = [[user1Wallet.address, 3]];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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
      orderTxInputs.push(orderTxInput);
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
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeOneHourEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeOneHourEarly,
      });
      invariant(!txBuilderResult.ok, "Mint Tx Building should fail");
      assert(txBuilderResult.error.message.includes("not whitelisted"));

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
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
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
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // user_4 orders 5 new assets who is whitelisted
  myTest(
    "user_4 orders 5 new assets who is whitelisted",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user4Wallet = usersWallets[3];
      const orders: Order[] = [[user4Wallet.address, 5]];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user4Wallet.address,
        await user4Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await user4Wallet.signTx(tx));
      const txId = await user4Wallet.submitTx(tx);
      emulator.tick(200);

      const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, 0));
      orderTxInputs.push(orderTxInput);
    }
  );

  // mint 5 new assets - <hal-4, hal-5, hal-6, hal-7, hal-8> as whitelisted
  myTest(
    "mint 5 new assets - <hal-4, hal-5, hal-6, hal-7, hal-8> as whitelisted",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeTwoHoursEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-4", makeHalAssetDatum("hal-4")],
        ["hal-5", makeHalAssetDatum("hal-5")],
        ["hal-6", makeHalAssetDatum("hal-6")],
        ["hal-7", makeHalAssetDatum("hal-7")],
        ["hal-8", makeHalAssetDatum("hal-8")],
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeTwoHoursEarly,
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
      emulator.currentSlot = Math.ceil(
        whitelistMintingTimeTwoHoursEarly / 1000
      );

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // user_1 can update <hal-1> datum
  myTest(
    "user_1 can update <hal-1> datum",
    async ({ isMainnet, network, emulator, wallets, deployedScripts }) => {
      const { usersWallets, refSpendAdminWallet } = wallets;
      const user1Wallet = usersWallets[0];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput, settingsV1 } = settingsResult.data;
      const { policy_id, ref_spend_proxy_script_hash } = settingsV1;
      const refSpendProxyScriptAddress = makeAddress(
        isMainnet,
        makeValidatorHash(ref_spend_proxy_script_hash)
      );
      const refUtxos = await emulator.getUtxos(refSpendProxyScriptAddress);

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
        settingsAssetTxInput,
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
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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
        orderTxInputs.push(orderTxInput);
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
      orderTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
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
    async ({ network, wallets, orderTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];

      const txBuilderResult = await cancel({
        network,
        address: user2Wallet.address,
        orderTxInput: orderTxInputs[0],
        deployedScripts,
      });
      invariant(txBuilderResult.ok, "Cancel Tx Building failed");

      // hack: cancel one other order also
      // without burning order token
      const txBuilder = txBuilderResult.data;
      txBuilder.spendUnsafe(
        orderTxInputs[1],
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

  // cannot refund 2 orders in a transaction
  myTest(
    "cannot refund 2 orders in a transaction",
    async ({ network, wallets, orderTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await refund({
        network,
        orderTxInput: orderTxInputs[0],
        refundingAddress: user2Wallet.address,
        deployedScripts,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Refund Tx Building failed");

      // hack: cancel one other order also
      // without burning order token
      const txBuilder = txBuilderResult.data;
      txBuilder.spendUnsafe(
        orderTxInputs[1],
        buildOrdersSpendRefundOrderRedeemer()
      );

      const txResult = await mayFailTransaction(
        txBuilder,
        user2Wallet.address,
        await user2Wallet.utxos
      ).complete();
      invariant(!txResult.ok, "Refund Tx Complete should fail");
      assert(txResult.error.message.includes("expect own_utxo_count == 1"));
    }
  );

  // can cancel one order
  myTest(
    "can cancel one order",
    async ({ network, emulator, wallets, orderTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user2Wallet = usersWallets[1];
      const beforeUser2Lovelace = (await balanceOfWallet(user2Wallet)).lovelace;
      const orderUtxoLovelace = orderTxInputs[1].value.lovelace;

      const txBuilderResult = await cancel({
        network,
        address: user2Wallet.address,
        orderTxInput: orderTxInputs[1],
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
        afterUser2Lovelace - beforeUser2Lovelace >
          orderUtxoLovelace - 1_000_000n,
        "User 2 Lovelace is not correct"
      );

      orderTxInputs.splice(1, 1);
    }
  );

  // can refund one order
  myTest(
    "can refund one order",
    async ({ network, emulator, wallets, orderTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets, allowedMinterWallet } = wallets;
      const user2Wallet = usersWallets[1];
      const beforeUser2Lovelace = (await balanceOfWallet(user2Wallet)).lovelace;
      const orderUtxoLovelace = orderTxInputs[0].value.lovelace;

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const txBuilderResult = await refund({
        network,
        orderTxInput: orderTxInputs[0],
        refundingAddress: user2Wallet.address,
        deployedScripts,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Refund Tx Building failed");

      const txBuilder = txBuilderResult.data;
      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        user2Wallet.address,
        []
      ).complete();
      invariant(txResult.ok, "Refund Tx Complete failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      const afterUser2Lovelace = (await balanceOfWallet(user2Wallet)).lovelace;

      invariant(
        afterUser2Lovelace - beforeUser2Lovelace >
          orderUtxoLovelace - 1_000_000n,
        "User 2 Lovelace is not correct"
      );

      orderTxInputs.splice(0, 1);
    }
  );

  // user_1 request order with invalid datum
  myTest(
    "user_1 request order with invalid datum",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user1Wallet = usersWallets[0];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      // user_1 make Order UTxO with invalid datum
      const txBuilderResult = await request({
        network,
        orders: [[user1Wallet.address, 2]],
        settings,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      // remove correct datum
      txBuilder.outputs[0].datum = makeInlineTxOutputDatum(makeVoidData());
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
      orderTxInputs.push(orderTxInput);
    }
  );

  // refund order with invalid datum
  myTest(
    "refund order with invalid datum",
    async ({ network, emulator, wallets, orderTxInputs, deployedScripts }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets, allowedMinterWallet } = wallets;
      const user1Wallet = usersWallets[0];
      const beforeUser1Lovelace = (await balanceOfWallet(user1Wallet)).lovelace;
      const orderUtxoLovelace = orderTxInputs[0].value.lovelace;

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;

      const refundingAddress = user1Wallet.address;
      const txBuilderResult = await refund({
        network,
        orderTxInput: orderTxInputs[0],
        refundingAddress,
        deployedScripts,
        settingsAssetTxInput,
      });
      invariant(txBuilderResult.ok, "Refund Tx Building failed");

      const txBuilder = txBuilderResult.data;
      txBuilder.addCollateral((await allowedMinterWallet.utxos)[0]);
      const txResult = await mayFailTransaction(
        txBuilder,
        refundingAddress,
        []
      ).complete();
      invariant(txResult.ok, "Refund Tx Complete failed");
      logMemAndCpu(txResult);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      const afterUser1Lovelace = (await balanceOfWallet(user1Wallet)).lovelace;

      invariant(
        afterUser1Lovelace - beforeUser1Lovelace >
          orderUtxoLovelace - 1_000_000n,
        "User 1 Lovelace is not correct"
      );

      orderTxInputs.length = 0;
    }
  );

  // user_1 orders 3 new assets
  myTest(
    "user_1 orders 3 new assets",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user1Wallet = usersWallets[0];
      const orders: Order[] = [[user1Wallet.address, 3]];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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
      orderTxInputs.push(orderTxInput);
    }
  );

  // mint 3 new assets - <hal-9, hal-10, hal-11>
  myTest(
    "mint 3 new assets - <hal-9, hal-10, hal-11>",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = [
        ["hal-9", makeHalAssetDatum("hal-9")],
        ["hal-10", makeHalAssetDatum("hal-10")],
        ["hal-11", makeHalAssetDatum("hal-11")],
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
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
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // user_3 orders 5 new assets 3 times
  myTest(
    "user_3 orders 5 new assets 3 times",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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
        orderTxInputs.push(orderTxInput);
      }
    }
  );

  // mint 15 new assets - <hal-101 ~ hal-115> - 1 user recieve 15 assets
  myTest(
    "mint 15 new assets - <hal-101 ~ hal-115> - 1 user recieve 15 assets",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
        maxOrderAmountInOneTx: 15,
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
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // user_1, user_2, user_3 order 5 new assets
  myTest(
    "user_1, user_2, user_3 order 5 new assets",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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
        orderTxInputs.push(orderTxInput);
      }
    }
  );

  // mint 15 new assets - <hal-151 ~ hal-165> - 3 users recieve 5 assets each
  myTest(
    "mint 15 new assets - <hal-151 ~ hal-165> - 3 users recieve 5 assets each",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      normalMintingTime,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: normalMintingTime,
        maxOrderAmountInOneTx: 15,
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
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // user_4 orders 9 new assets who is whitelisted
  myTest(
    "user_4 orders 9 new assets who is whitelisted",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { usersWallets } = wallets;
      const user4Wallet = usersWallets[3];
      const orders: Order[] = [
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
        [user4Wallet.address, 1],
      ];

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
      });
      invariant(txBuilderResult.ok, "Order Tx Building failed");

      const txBuilder = txBuilderResult.data;
      const txResult = await mayFailTransaction(
        txBuilder,
        user4Wallet.address,
        await user4Wallet.utxos
      ).complete();
      invariant(txResult.ok, "Order Tx Complete failed");

      const { tx } = txResult.data;
      tx.addSignatures(await user4Wallet.signTx(tx));
      const txId = await user4Wallet.submitTx(tx);
      emulator.tick(200);

      for (let i = 0; i < 9; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        orderTxInputs.push(orderTxInput);
      }
    }
  );

  // can not mint 9 new assets - <hal-201 ~ hal-209> as whitelisted because whitelisted value is not enough
  myTest(
    "can not mint 9 new assets - <hal-201 ~ hal-209> as whitelisted because whitelisted value is not enough",
    async ({
      db,
      whitelistDB,
      network,
      wallets,
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeTwoHoursEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 9 },
        (_, index) => [
          `hal-20${index + 1}`,
          makeHalAssetDatum(`hal-20${index + 1}`),
        ]
      );

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settingsAssetTxInput } = settingsResult.data;
      const mintingDataResult = await fetchMintingData();
      invariant(mintingDataResult.ok, "Minting Data Fetch failed");
      const { mintingDataAssetTxInput } = mintingDataResult.data;

      const txBuilderResult = await prepareMintTransaction({
        network,
        address: allowedMinterWallet.address,
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeTwoHoursEarly,
        maxOrderAmountInOneTx: 9,
      });
      invariant(!txBuilderResult.ok, "Mint Tx Building should fail");
      assert(
        txBuilderResult.error.message.includes("insufficient whitelisted value")
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

  // can mint 9 new assets - <hal-201 ~ hal-209> as whitelisted
  myTest(
    "can mint 9 new assets - <hal-201 ~ hal-209> as whitelisted",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeOneHourEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 9 },
        (_, index) => [
          `hal-20${index + 1}`,
          makeHalAssetDatum(`hal-20${index + 1}`),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeOneHourEarly,
        maxOrderAmountInOneTx: 9,
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
      emulator.currentSlot = Math.ceil(whitelistMintingTimeOneHourEarly / 1000);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // special user_1 ~ user_8 orders 8 new assets
  myTest(
    "special user_1 ~ user_8 orders 8 new assets",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { specialUsersWallets, fundWallet } = wallets;
      const orders: Order[] = Array.from({ length: 8 }, (_, index) => [
        specialUsersWallets[index].address,
        1,
      ]);

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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

      for (let i = 0; i < 8; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        orderTxInputs.push(orderTxInput);
      }
    }
  );

  // can mint 8 new assets from 8 order UTxOs - <hal-301 ~ hal-308> as whitelisted
  myTest(
    "can mint 8 new assets from 8 order UTxOs - <hal-301 ~ hal-308> as whitelisted",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeTwoHoursEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 8 },
        (_, index) => [
          `hal-30${index + 1}`,
          makeHalAssetDatum(`hal-30${index + 1}`),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeTwoHoursEarly,
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
      emulator.currentSlot = Math.ceil(
        whitelistMintingTimeTwoHoursEarly / 1000
      );

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );

  // special user_1 ~ user_4 orders 8 new assets
  myTest(
    "special user_1 ~ user_4 orders 8 new assets",
    async ({ network, emulator, wallets, orderTxInputs }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { specialUsersWallets, fundWallet } = wallets;
      const orders: Order[] = Array.from({ length: 4 }, (_, index) => [
        specialUsersWallets[index].address,
        2,
      ]);

      const settingsResult = await fetchSettings(network);
      invariant(settingsResult.ok, "Settings Fetch Failed");
      const { settings } = settingsResult.data;

      const txBuilderResult = await request({
        network,
        orders,
        settings,
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

      for (let i = 0; i < 4; i++) {
        const orderTxInput = await emulator.getUtxo(makeTxOutputId(txId, i));
        orderTxInputs.push(orderTxInput);
      }
    }
  );

  // can mint 8 new assets from 4 order UTxOs - <hal-401 ~ hal-408> as whitelisted
  myTest(
    "can mint 8 new assets from 4 order UTxOs - <hal-401 ~ hal-408> as whitelisted",
    async ({
      mockedFunctions,
      db,
      whitelistDB,
      network,
      emulator,
      wallets,
      orderTxInputs,
      deployedScripts,
      whitelistMintingTimeOneHourEarly,
    }) => {
      invariant(
        Array.isArray(orderTxInputs),
        "Orders tx inputs is not an array"
      );

      const { allowedMinterWallet, paymentWallet } = wallets;

      const assetsInfo: HalAssetInfo[] = Array.from(
        { length: 8 },
        (_, index) => [
          `hal-40${index + 1}`,
          makeHalAssetDatum(`hal-40${index + 1}`),
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
        orderTxInputs,
        assetsInfo,
        db,
        whitelistDB,
        deployedScripts,
        settingsAssetTxInput,
        mintingDataAssetTxInput,
        mintingTime: whitelistMintingTimeOneHourEarly,
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
      emulator.currentSlot = Math.ceil(whitelistMintingTimeOneHourEarly / 1000);

      const { tx } = txResult.data;
      tx.addSignatures(await allowedMinterWallet.signTx(tx));
      const txId = await allowedMinterWallet.submitTx(tx);
      emulator.tick(200);

      // check minted assets
      await checkMintedAssets(
        network,
        emulator,
        settingsV1,
        orderTxInputs,
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
      orderTxInputs.length = 0;
    }
  );
});
