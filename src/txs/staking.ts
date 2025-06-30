import { bytesToHex } from "@helios-lang/codec-utils";
import {
  Address,
  makeRegistrationDCert,
  parseStakingAddress,
  TxInput,
} from "@helios-lang/ledger";
import { makeTxBuilder, NetworkName } from "@helios-lang/tx-utils";

const registerStakingAddresses = async (
  network: NetworkName,
  changeAddress: Address,
  spareUtxos: TxInput[],
  bech32StakingAddresses: string[]
) => {
  const txBuilder = makeTxBuilder({ isMainnet: network == "mainnet" });

  bech32StakingAddresses.forEach((stakingAddress) => {
    txBuilder.addDCert(
      makeRegistrationDCert(
        parseStakingAddress(stakingAddress).stakingCredential
      )
    );
  });
  const tx = await txBuilder.build({
    changeAddress,
    spareUtxos,
  });
  return bytesToHex(tx.toCbor());
};

export { registerStakingAddresses };
