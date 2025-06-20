import { makeConstrData, makeIntData, UplcData } from "@helios-lang/uplc";

const buildRoyaltyFlagCIP68ExtraData = (): UplcData => {
  return makeConstrData(0, [makeIntData(1)]);
};

export { buildRoyaltyFlagCIP68ExtraData };
