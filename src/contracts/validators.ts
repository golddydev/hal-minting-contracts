import { decodeUplcProgramV2FromCbor, UplcProgramV2 } from "@helios-lang/uplc";

import { invariant } from "../helpers/index.js";
import optimizedBlueprint from "./optimized-blueprint.js";
import unOptimizedBlueprint from "./unoptimized-blueprint.js";
import {
  makeMintingDataUplcProgramParameter,
  makeMintProxyUplcProgramParameter,
  makeMintUplcProgramParameter,
  makeOrdersSpendUplcProgramParameter,
} from "./utils.js";

const getMintProxyMintUplcProgram = (mint_version: bigint): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "mint_proxy.mint"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "mint_proxy.mint"
  );
  invariant(
    !!optimizedFoundValidator && !!unOptimizedFoundValidator,
    "Mint Proxy Mint Validator not found"
  );
  return decodeUplcProgramV2FromCbor(optimizedFoundValidator.compiledCode)
    .apply(makeMintProxyUplcProgramParameter(mint_version))
    .withAlt(
      decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode).apply(
        makeMintProxyUplcProgramParameter(mint_version)
      )
    );
};

const getMintWithdrawUplcProgram = (
  minting_data_script_hash: string
): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "mint.withdraw"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "mint.withdraw"
  );
  invariant(
    !!optimizedFoundValidator && unOptimizedFoundValidator,
    "Mint Withdrawal Validator not found"
  );
  return decodeUplcProgramV2FromCbor(optimizedFoundValidator.compiledCode)
    .apply(makeMintUplcProgramParameter(minting_data_script_hash))
    .withAlt(
      decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode).apply(
        makeMintUplcProgramParameter(minting_data_script_hash)
      )
    );
};

// this is `minting_data_script_hash`
const getMintingDataSpendUplcProgram = (
  admin_verification_key_hash: string
): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "minting_data.spend"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "minting_data.spend"
  );
  invariant(
    !!optimizedFoundValidator && !!unOptimizedFoundValidator,
    "Minting Data Spend Validator not found"
  );
  return decodeUplcProgramV2FromCbor(optimizedFoundValidator.compiledCode)
    .apply(makeMintingDataUplcProgramParameter(admin_verification_key_hash))
    .withAlt(
      decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode).apply(
        makeMintingDataUplcProgramParameter(admin_verification_key_hash)
      )
    );
};

const getOrdersSpendUplcProgram = (
  hal_policy_id: string,
  randomizer: string
): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "orders_spend.spend"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "orders_spend.spend"
  );
  invariant(
    !!optimizedFoundValidator && !!unOptimizedFoundValidator,
    "Orders Spend Validator not found"
  );
  return decodeUplcProgramV2FromCbor(optimizedFoundValidator.compiledCode)
    .apply(makeOrdersSpendUplcProgramParameter(hal_policy_id, randomizer))
    .withAlt(
      decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode).apply(
        makeOrdersSpendUplcProgramParameter(hal_policy_id, randomizer)
      )
    );
};

const getRefSpendUplcProgram = (): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "ref_spend.spend"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "ref_spend.spend"
  );
  invariant(
    !!optimizedFoundValidator && !!unOptimizedFoundValidator,
    "Ref Spend Validator not found"
  );
  return decodeUplcProgramV2FromCbor(
    optimizedFoundValidator.compiledCode
  ).withAlt(
    decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode)
  );
};

const getRoyaltySpendUplcProgram = (): UplcProgramV2 => {
  const optimizedFoundValidator = optimizedBlueprint.validators.find(
    (validator) => validator.title == "royalty_spend.spend"
  );
  const unOptimizedFoundValidator = unOptimizedBlueprint.validators.find(
    (validator) => validator.title == "royalty_spend.spend"
  );
  invariant(
    !!optimizedFoundValidator && !!unOptimizedFoundValidator,
    "Ref Spend Validator not found"
  );
  return decodeUplcProgramV2FromCbor(
    optimizedFoundValidator.compiledCode
  ).withAlt(
    decodeUplcProgramV2FromCbor(unOptimizedFoundValidator.compiledCode)
  );
};

export {
  getMintingDataSpendUplcProgram,
  getMintProxyMintUplcProgram,
  getMintWithdrawUplcProgram,
  getOrdersSpendUplcProgram,
  getRefSpendUplcProgram,
  getRoyaltySpendUplcProgram,
};
