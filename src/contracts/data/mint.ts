import { makeConstrData, UplcData } from "@helios-lang/uplc";

const buildMintMintNFTsRedeemer = (): UplcData => {
  return makeConstrData(0, []);
};

const buildMintBurnNFTsRedeemer = (): UplcData => {
  return makeConstrData(1, []);
};

const buildMintMintRoyaltyNFTRedeemer = (): UplcData => {
  return makeConstrData(2, []);
};

export {
  buildMintBurnNFTsRedeemer,
  buildMintMintNFTsRedeemer,
  buildMintMintRoyaltyNFTRedeemer,
};
