import { ShelleyAddress } from "@helios-lang/ledger";

interface OrderDatum {
  // the key hash of the wallet that placed the order that is used for cancelling the order
  owner_key_hash: string;
  // address that the asset should be sent to
  destination_address: ShelleyAddress;
  // amount of HAL NFTs to mint
  amount: number;
}

type Order = [ShelleyAddress, number];

export type { Order, OrderDatum };
