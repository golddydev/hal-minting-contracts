import { bytesToHex } from "@helios-lang/codec-utils";
import { makeTxOutputId, TxInput } from "@helios-lang/ledger";
import { BlockfrostV0Client, NetworkName } from "@helios-lang/tx-utils";
import { decodeUplcProgramV2FromCbor, UplcProgramV2 } from "@helios-lang/uplc";
import { ScriptDetails, ScriptType } from "@koralabs/kora-labs-common";
import { Err, Ok, Result } from "ts-res";

import { CONTRACT_NAMES } from "../constants/index.js";
import {
  buildContracts,
  makeMintingDataUplcProgramParameterDatum,
  makeMintProxyUplcProgramParameterDatum,
  makeMintUplcProgramParameterDatum,
  makeOrdersSpendUplcProgramParameterDatum,
} from "../contracts/index.js";
import { convertError, invariant } from "../helpers/index.js";
import { fetchDeployedScript } from "../utils/contract.js";

/**
 * @interface
 * @typedef {object} DeployParams
 * @property {NetworkName} network Network
 * @property {bigint} mintVersion Mint Version - Parameter in Mint Proxy validator
 * @property {string} adminVerificationKeyHash Admin Verification Key  Hash - Parameter in Minting Data Spending Validator
 * @property {string} contractName Contract Name to Deploy
 */
interface DeployParams {
  network: NetworkName;
  mintVersion: bigint;
  adminVerificationKeyHash: string;
  contractName: string;
  ordersSpendRandomizer?: string | undefined;
}

interface DeployData {
  optimizedCbor: string;
  unOptimizedCbor?: string;
  datumCbor?: string;
  validatorHash: string;
  policyId?: string;
  scriptAddress?: string;
  scriptStakingAddress?: string;
}

/**
 * @description Deploy one of De-Mi contracts
 * @param {DeployParams} params
 * @returns {Promise<DeployData>} Deploy Data
 */
const deploy = async (params: DeployParams): Promise<DeployData> => {
  const {
    network,
    mintVersion,
    adminVerificationKeyHash,
    contractName,
    ordersSpendRandomizer = "",
  } = params;

  const contractsConfig = buildContracts({
    network,
    mint_version: mintVersion,
    admin_verification_key_hash: adminVerificationKeyHash,
    orders_spend_randomizer: ordersSpendRandomizer,
  });
  const {
    halPolicyHash,
    mintProxy: mintProxyConfig,
    mint: mintConfig,
    mintingData: mintingDataConfig,
    ordersSpend: ordersSpendConfig,
    refSpend: refSpendConfig,
  } = contractsConfig;

  switch (contractName) {
    case "mint_proxy.mint":
      return {
        ...extractScriptCborsFromUplcProgram(
          mintProxyConfig.mintProxyMintUplcProgram
        ),
        datumCbor: bytesToHex(
          makeMintProxyUplcProgramParameterDatum(mintVersion).data.toCbor()
        ),
        validatorHash: mintProxyConfig.mintProxyPolicyHash.toHex(),
        policyId: mintProxyConfig.mintProxyPolicyHash.toHex(),
      };
    case "minting_data.spend":
      return {
        ...extractScriptCborsFromUplcProgram(
          mintingDataConfig.mintingDataSpendUplcProgram
        ),
        datumCbor: bytesToHex(
          makeMintingDataUplcProgramParameterDatum(
            adminVerificationKeyHash
          ).data.toCbor()
        ),
        validatorHash: mintingDataConfig.mintingDataValidatorHash.toHex(),
        scriptAddress: mintingDataConfig.mintingDataValidatorAddress.toBech32(),
      };
    case "mint.withdraw":
      return {
        ...extractScriptCborsFromUplcProgram(
          mintConfig.mintWithdrawUplcProgram
        ),
        datumCbor: bytesToHex(
          makeMintUplcProgramParameterDatum(
            mintingDataConfig.mintingDataValidatorHash.toHex()
          ).data.toCbor()
        ),
        validatorHash: mintConfig.mintValidatorHash.toHex(),
        scriptStakingAddress: mintConfig.mintStakingAddress.toBech32(),
      };
    case "orders_spend.spend":
      return {
        ...extractScriptCborsFromUplcProgram(
          ordersSpendConfig.ordersSpendUplcProgram
        ),
        datumCbor: bytesToHex(
          makeOrdersSpendUplcProgramParameterDatum(
            halPolicyHash.toHex(),
            ordersSpendRandomizer
          ).data.toCbor()
        ),
        validatorHash: ordersSpendConfig.ordersValidatorHash.toHex(),
        scriptAddress: ordersSpendConfig.ordersSpendValidatorAddress.toBech32(),
      };
    case "ref_spend.spend":
      return {
        ...extractScriptCborsFromUplcProgram(
          refSpendConfig.refSpendUplcProgram
        ),
        validatorHash: refSpendConfig.refSpendValidatorHash.toHex(),
        scriptAddress: refSpendConfig.refSpendValidatorAddress.toBech32(),
      };
    default:
      throw new Error(
        `Contract name must be one of ${CONTRACT_NAMES.join(", ")}`
      );
  }
};

const extractScriptCborsFromUplcProgram = (
  uplcProgram: UplcProgramV2
): { optimizedCbor: string; upOptimizedCbor?: string } => {
  return {
    optimizedCbor: bytesToHex(uplcProgram.toCbor()),
    upOptimizedCbor: uplcProgram.alt
      ? bytesToHex(uplcProgram.alt.toCbor())
      : undefined,
  };
};

interface DeployedScripts {
  mintProxyScriptDetails: ScriptDetails;
  mintProxyScriptTxInput: TxInput;
  mintingDataScriptDetails: ScriptDetails;
  mintingDataScriptTxInput: TxInput;
  mintScriptDetails: ScriptDetails;
  mintScriptTxInput: TxInput;
  ordersSpendScriptDetails: ScriptDetails;
  ordersSpendScriptTxInput: TxInput;
  refSpendScriptDetails: ScriptDetails;
  refSpendScriptTxInput: TxInput;
}

const fetchAllDeployedScripts = async (
  blockfrostV0Client: BlockfrostV0Client
): Promise<Result<DeployedScripts, string>> => {
  try {
    // "mint_proxy.mint"
    const mintProxyScriptDetails = await fetchDeployedScript(
      ScriptType.HAL_MINT_PROXY
    );
    invariant(
      mintProxyScriptDetails.refScriptUtxo,
      "Mint Proxy has no Ref script UTxO"
    );
    const mintProxyScriptTxInput = await blockfrostV0Client.getUtxo(
      makeTxOutputId(mintProxyScriptDetails.refScriptUtxo)
    );
    if (mintProxyScriptDetails.unoptimizedCbor)
      mintProxyScriptTxInput.output.refScript = (
        mintProxyScriptTxInput.output.refScript as UplcProgramV2
      )?.withAlt(
        decodeUplcProgramV2FromCbor(mintProxyScriptDetails.unoptimizedCbor)
      );

    // "minting_data.spend"
    const mintingDataScriptDetails = await fetchDeployedScript(
      ScriptType.HAL_MINTING_DATA
    );
    invariant(
      mintingDataScriptDetails.refScriptUtxo,
      "Minting Data has no Ref script UTxO"
    );
    const mintingDataScriptTxInput = await blockfrostV0Client.getUtxo(
      makeTxOutputId(mintingDataScriptDetails.refScriptUtxo)
    );
    if (mintingDataScriptDetails.unoptimizedCbor)
      mintingDataScriptTxInput.output.refScript = (
        mintingDataScriptTxInput.output.refScript as UplcProgramV2
      )?.withAlt(
        decodeUplcProgramV2FromCbor(mintingDataScriptDetails.unoptimizedCbor)
      );

    // "mint.withdraw"
    const mintScriptDetails = await fetchDeployedScript(ScriptType.HAL_MINT);
    invariant(mintScriptDetails.refScriptUtxo, "Mint has no Ref script UTxO");
    const mintScriptTxInput = await blockfrostV0Client.getUtxo(
      makeTxOutputId(mintScriptDetails.refScriptUtxo)
    );
    if (mintScriptDetails.unoptimizedCbor)
      mintScriptTxInput.output.refScript = (
        mintScriptTxInput.output.refScript as UplcProgramV2
      )?.withAlt(
        decodeUplcProgramV2FromCbor(mintScriptDetails.unoptimizedCbor)
      );

    // "orders_spend.spend"
    const ordersSpendScriptDetails = await fetchDeployedScript(
      ScriptType.HAL_ORDERS_SPEND
    );
    invariant(
      ordersSpendScriptDetails.refScriptUtxo,
      "Orders Spend has no Ref script UTxO"
    );
    const ordersSpendScriptTxInput = await blockfrostV0Client.getUtxo(
      makeTxOutputId(ordersSpendScriptDetails.refScriptUtxo)
    );
    if (ordersSpendScriptDetails.unoptimizedCbor)
      ordersSpendScriptTxInput.output.refScript = (
        ordersSpendScriptTxInput.output.refScript as UplcProgramV2
      )?.withAlt(
        decodeUplcProgramV2FromCbor(ordersSpendScriptDetails.unoptimizedCbor)
      );

    // "ref_spend.spend"
    const refSpendScriptDetails = await fetchDeployedScript(
      ScriptType.HAL_REF_SPEND
    );
    invariant(
      refSpendScriptDetails.refScriptUtxo,
      "Ref Spend has no Ref script UTxO"
    );
    const refSpendScriptTxInput = await blockfrostV0Client.getUtxo(
      makeTxOutputId(refSpendScriptDetails.refScriptUtxo)
    );
    if (refSpendScriptDetails.unoptimizedCbor)
      refSpendScriptTxInput.output.refScript = (
        refSpendScriptTxInput.output.refScript as UplcProgramV2
      )?.withAlt(
        decodeUplcProgramV2FromCbor(refSpendScriptDetails.unoptimizedCbor)
      );

    return Ok({
      mintProxyScriptDetails,
      mintProxyScriptTxInput,
      mintingDataScriptDetails,
      mintingDataScriptTxInput,
      mintScriptDetails,
      mintScriptTxInput,
      ordersSpendScriptDetails,
      ordersSpendScriptTxInput,
      refSpendScriptDetails,
      refSpendScriptTxInput,
    });
  } catch (err) {
    return Err(convertError(err));
  }
};

export type { DeployData, DeployedScripts, DeployParams };
export { deploy, fetchAllDeployedScripts };
