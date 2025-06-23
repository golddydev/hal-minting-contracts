import { makeConstrData, UplcData } from "@helios-lang/uplc";

const buildMintV1MintNFTsRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildMintV1BurnNFTsRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

const buildMintV1MintRoyaltyNFTRedeemer = (): UplcData => {
  return makeConstrData(2, []);
};

export {
  buildMintV1BurnNFTsRedeemer,
  buildMintV1MintNFTsRedeemer,
  buildMintV1MintRoyaltyNFTRedeemer,
};
