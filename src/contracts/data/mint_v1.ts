import { makeConstrData, UplcData } from "@helios-lang/uplc";

const buildMintV1MintNFTsRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildMintV1BurnNFTsRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

export { buildMintV1BurnNFTsRedeemer, buildMintV1MintNFTsRedeemer };
