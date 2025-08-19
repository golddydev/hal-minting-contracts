import { bytesToHex } from "@helios-lang/codec-utils";
import {
  Address,
  addValues,
  makeAddress,
  makeAssetClass,
  makeAssets,
  makeInlineTxOutputDatum,
  makeValidatorHash,
  makeValue,
  Tx,
} from "@helios-lang/ledger";
import { Emulator, SimpleWallet } from "@helios-lang/tx-utils";
import {
  decodeUplcProgramV2FromCbor,
  makeByteArrayData,
  makeConstrData,
  makeIntData,
  makeMapData,
  UplcProgramV2,
} from "@helios-lang/uplc";
import colors from "ansi-colors";
import fs from "fs/promises";
import { Result } from "ts-res";

import { PREFIX_100, PREFIX_222 } from "../src/constants/index.js";
import {
  BuildTxError,
  HalUserOutputData,
  invariant,
  makeVoidData,
  SettingsV1,
  TxSuccessResult,
} from "../src/index.js";

const alwaysSucceedMintUplcProgram = (): UplcProgramV2 => {
  return decodeUplcProgramV2FromCbor(
    "5834010000323232323222533300353330033370e900018021baa3006300730053754002294458526136565734aae7555cf2ba157441"
  );
};

const extractScriptCborsFromUplcProgram = (
  uplcProgram: UplcProgramV2
): [string, string] => {
  return [
    bytesToHex(uplcProgram.toCbor()),
    bytesToHex(uplcProgram.alt!.toCbor()),
  ];
};

const balanceOfAddress = async (emulator: Emulator, address: Address) => {
  const utxos = await emulator.getUtxos(address);
  const balance = utxos.reduce((acc, utxo) => {
    return addValues([acc, utxo.value]);
  }, makeValue(0n));
  return balance;
};

const balanceOfWallet = async (wallet: SimpleWallet) => {
  const utxos = await wallet.utxos;
  const balance = utxos.reduce((acc, utxo) => {
    return addValues([acc, utxo.value]);
  }, makeValue(0n));
  return balance;
};

const referenceAssetClass = (policyId: string, handleName: string) => {
  return makeAssetClass(
    `${policyId}.${PREFIX_100}${Buffer.from(handleName).toString("hex")}`
  );
};

const userAssetClass = (policyId: string, handleName: string) => {
  return makeAssetClass(
    `${policyId}.${PREFIX_222}${Buffer.from(handleName).toString("hex")}`
  );
};

const referenceAssetValue = (policyId: string, handleName: string) => {
  return makeValue(
    1n,
    makeAssets([
      [
        makeAssetClass(
          `${policyId}.${PREFIX_100}${Buffer.from(handleName).toString("hex")}`
        ),
        1n,
      ],
    ])
  );
};

const userAssetValue = (policyId: string, handleName: string) => {
  return makeValue(
    1n,
    makeAssets([
      [
        makeAssetClass(
          `${policyId}.${PREFIX_222}${Buffer.from(handleName).toString("hex")}`
        ),
        1n,
      ],
    ])
  );
};

const writeSuccessfulTxJson = async (
  txResult: Result<TxSuccessResult, Error | BuildTxError>
) => {
  invariant(txResult.ok);
  await fs.writeFile(
    "successful-tx.json",
    JSON.stringify(
      {
        txJson: txResult.data.dump,
        txCbor: bytesToHex(txResult.data.tx.toCbor()),
      },
      null,
      2
    )
  );
};

const writeFailedTxJson = async (
  txResult: Result<TxSuccessResult, Error | BuildTxError>
) => {
  invariant(!txResult.ok);
  const error = txResult.error as BuildTxError;
  await fs.writeFile(
    "failed-tx.json",
    JSON.stringify(
      {
        failedTxJson: error.failedTxJson,
        failedTxCbor: error.failedTxCbor,
      },
      null,
      2
    )
  );
};

const logMemAndCpu = async (
  txResult: Result<TxSuccessResult, Error | BuildTxError>
) => {
  invariant(txResult.ok);
  const maxMem = 14000000;
  const maxCpu = 10000000000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dump = txResult.data.dump as any;
  const { mem, cpu } = dump.witnesses.redeemers.reduce(
    ({ mem, cpu }, cur) => ({
      mem: mem + parseInt(cur.exUnits.mem),
      cpu: cpu + parseInt(cur.exUnits.cpu),
    }),
    { mem: 0, cpu: 0 }
  );
  console.log(
    colors.bold.green(
      `mem: ${mem} (${((mem / maxMem) * 100).toFixed(3)} %), cpu: ${cpu} (${(
        (cpu / maxCpu) *
        100
      ).toFixed(3)} %), tx size: ${txResult.data.tx.toCbor().length} bytes`
    )
  );
};

const makeHalAssetDatum = (assetName: string) => {
  const hexName = Buffer.from(assetName).toString("hex");
  return makeInlineTxOutputDatum(
    makeConstrData(0, [
      makeMapData([
        [makeByteArrayData(Buffer.from("name")), makeByteArrayData(hexName)],
      ]),
      makeIntData(0),
      makeVoidData(),
    ])
  );
};

const checkMintedAssets = async (
  isMainnet: boolean,
  emulator: Emulator,
  settingsV1: SettingsV1,
  userOutputsData: HalUserOutputData[]
) => {
  const { policy_id, ref_spend_proxy_script_hash } = settingsV1;
  const refSpendProxyScriptAddress = makeAddress(
    isMainnet,
    makeValidatorHash(ref_spend_proxy_script_hash)
  );
  const refSpendBalance = await balanceOfAddress(
    emulator,
    refSpendProxyScriptAddress
  );

  for (let i = 0; i < userOutputsData.length; i++) {
    const halOutputsData = userOutputsData[i];
    const { assetUtf8Names, destinationAddress } = halOutputsData;
    const userBalance = await balanceOfAddress(emulator, destinationAddress);
    for (const assetName of assetUtf8Names) {
      invariant(
        userBalance.isGreaterOrEqual(userAssetValue(policy_id, assetName)) ==
          true,
        "User Balance is not correct"
      );

      invariant(
        refSpendBalance.isGreaterOrEqual(
          referenceAssetValue(policy_id, assetName)
        ) == true,
        "Ref Spend Wallet Balance is not correct"
      );
    }
  }
};

const collectFeeAndMinLovelace = (tx: Tx): bigint => {
  const minLovelace = tx.body.outputs.reduce((acc, output, index) => {
    if (index === 0 || index === tx.body.outputs.length - 1) {
      return acc;
    }
    return acc + output.value.lovelace;
  }, 0n);
  return minLovelace + tx.body.fee;
};

const collectFee = (tx: Tx): bigint => {
  return tx.body.fee;
};

export {
  alwaysSucceedMintUplcProgram,
  balanceOfAddress,
  balanceOfWallet,
  checkMintedAssets,
  collectFee,
  collectFeeAndMinLovelace,
  extractScriptCborsFromUplcProgram,
  logMemAndCpu,
  makeHalAssetDatum,
  referenceAssetClass,
  referenceAssetValue,
  userAssetClass,
  userAssetValue,
  writeFailedTxJson,
  writeSuccessfulTxJson,
};
