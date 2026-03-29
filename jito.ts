import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { SniperConfig } from "./config";

export async function buildVersionedTx(
  connection: Connection,
  payer: Keypair,
  instructions: TransactionInstruction[],
  addressLookupTables: import("@solana/web3.js").AddressLookupTableAccount[] = []
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message(addressLookupTables);
  const tx = new VersionedTransaction(message);
  tx.sign([payer]);
  return tx;
}

export function buildTipInstruction(
  payer: PublicKey,
  tipAccount: PublicKey,
  lamports: number
): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: tipAccount,
    lamports,
  });
}

export async function submitBundle(
  transactions: VersionedTransaction[],
  config: SniperConfig
): Promise<string> {
  const serialized = transactions.map((tx) =>
    Buffer.from(tx.serialize()).toString("base64")
  );

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "sendBundle",
    params: [serialized],
  });

  const response = await fetch(
    `${config.jitoBlockEngineUrl}/api/v1/bundles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Jito submit failed: ${response.status} ${text}`);
  }

  const json = (await response.json()) as { result?: string; error?: unknown };
  if (json.error) throw new Error(`Jito error: ${JSON.stringify(json.error)}`);
  return json.result ?? "unknown";
}
