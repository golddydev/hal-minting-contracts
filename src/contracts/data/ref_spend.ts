import { makeConstrData, UplcData } from "@helios-lang/uplc";
import { makeByteArrayData } from "@helios-lang/uplc";

const buildRefSpendRedeemer = (asset_name: string): UplcData => {
  return makeConstrData(0, [makeByteArrayData(asset_name)]);
};

export { buildRefSpendRedeemer };
