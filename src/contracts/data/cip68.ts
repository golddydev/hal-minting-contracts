import { UplcData } from "@helios-lang/uplc";
import { makeByteArrayData, makeConstrData } from "@helios-lang/uplc";

const buildCip68UpdateRedeemer = (asset_name: string): UplcData => {
  return makeConstrData(0, [makeByteArrayData(asset_name)]);
};

const buildCip68MigrateRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export { buildCip68MigrateRedeemer, buildCip68UpdateRedeemer };
