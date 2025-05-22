import { UplcData } from "@helios-lang/uplc";
import { makeByteArrayData, makeConstrData } from "@helios-lang/uplc";

const buildRefSpendUpdateRedeemer = (asset_name: string): UplcData => {
  return makeConstrData(0, [makeByteArrayData(asset_name)]);
};

const buildRefSpendMigrateRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export { buildRefSpendMigrateRedeemer, buildRefSpendUpdateRedeemer };
