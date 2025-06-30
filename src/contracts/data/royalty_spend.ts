import { makeConstrData, UplcData } from "@helios-lang/uplc";

const buildRoyaltySpendUpdateRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildRoyaltySpendMigrateRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export { buildRoyaltySpendMigrateRedeemer, buildRoyaltySpendUpdateRedeemer };
