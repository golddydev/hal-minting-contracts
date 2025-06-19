import {
  makeConstrData,
  makeIntData,
  makeListData,
  UplcData,
} from "@helios-lang/uplc";

import { RoyaltyDatum, RoyaltyRecipient } from "../types/index.js";
import { buildAddressData, makeOptionData } from "./common.js";

const buildRoyaltyDatumData = (royaltyDatum: RoyaltyDatum): UplcData => {
  const { recipients, version, extra } = royaltyDatum;

  return makeConstrData(0, [
    makeListData(recipients.map(buildRoyaltyRecipientData)),
    makeIntData(version),
    extra,
  ]);
};

const buildRoyaltyRecipientData = (recipient: RoyaltyRecipient): UplcData => {
  const { address, fee, min_fee, max_fee } = recipient;

  return makeConstrData(0, [
    buildAddressData(address),
    makeIntData(fee),
    makeOptionData(min_fee, makeIntData),
    makeOptionData(max_fee, makeIntData),
  ]);
};

export { buildRoyaltyDatumData, buildRoyaltyRecipientData };
