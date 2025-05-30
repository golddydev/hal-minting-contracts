import { Trie } from "@aiken-lang/merkle-patricia-forestry";
import { Address } from "@helios-lang/ledger";
import { NetworkName, TxBuilder } from "@helios-lang/tx-utils";
import { Err, Ok, Result } from "ts-res";

import { decodeOrderDatum } from "../contracts/index.js";
import { DeployedScripts } from "./deploy.js";
import { prepareMintTransaction } from "./prepareMint.js";
import { DecodedOrder, Order } from "./types.js";

/**
 * @interface
 * @typedef {object} MintParams
 * @property {NetworkName} network Network
 * @property {Address} address Wallet Address to perform mint
 * @property {Order[]} orders Order Tx Inputs and asset names to mint
 * @property {Trie} db Trie DB
 * @property {string} blockfrostApiKey Blockfrost API Key
 * @property {DeployedScripts} deployedScripts Deployed Scripts
 */
interface MintParams {
  network: NetworkName;
  address: Address;
  orders: Order[];
  db: Trie;
  deployedScripts: DeployedScripts;
}

/**
 * @description Mint Handles from Order (only new handles)
 * @param {MintParams} params
 * @returns {Promise<Result<TxBuilder,  Error>>} Transaction Result
 */
const mint = async (params: MintParams): Promise<Result<TxBuilder, Error>> => {
  const { network, orders } = params;

  // refactor Orders Tx Inputs
  // NOTE:
  // sort orderUtxos before process
  // because tx inputs is sorted lexicographically
  // we have to insert handle in `REVERSE` order as tx inputs
  orders
    .sort((a, b) =>
      a.orderTxInput.id.toString() > b.orderTxInput.id.toString() ? 1 : -1
    )
    .reverse();
  if (orders.length == 0) return Err(new Error("No Order requested"));
  console.log(`${orders.length} Orders are picked`);

  const decodedOrders: DecodedOrder[] = orders.map((order) => {
    const { orderTxInput, assetsInfo } = order;
    const decodedOrder = decodeOrderDatum(orderTxInput.datum, network);
    const { destination_address, price, amount } = decodedOrder;
    return {
      orderTxInput,
      assetsInfo,
      destinationAddress: destination_address,
      price,
      amount,
    };
  });

  const preparedTxBuilderResult = await prepareMintTransaction({
    ...params,
    decodedOrders,
  });

  if (!preparedTxBuilderResult.ok) {
    return Err(
      new Error(
        `Failed to prepare New Mint Transaction: ${preparedTxBuilderResult.error}`
      )
    );
  }
  const { txBuilder } = preparedTxBuilderResult.data;
  return Ok(txBuilder);
};

export type { MintParams };
export { mint };
