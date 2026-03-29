/**
 * PumpListener
 *
 * Subscribes to Solana logs via WebSocket and detects new Pump.fun token
 * launches in real time. Emits a `launch` event for each new token with
 * the mint address and the slot it was created in.
 *
 * Pump.fun program: 6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P
 *
 * A new launch emits an `initialize2` instruction on the bonding curve.
 * We detect it by watching for the Pump.fun program ID in log messages
 * and parsing the mint from the instruction accounts.
 */

import {
  Connection,
  PublicKey,
  ParsedTransactionWithMeta,
  PartiallyDecodedInstruction,
} from "@solana/web3.js";
import { EventEmitter } from "events";

export const PUMP_PROGRAM = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);

// The Raydium migration program — when pump graduates to Raydium
export const PUMP_MIGRATION = new PublicKey(
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg"
);

export interface LaunchEvent {
  mint: PublicKey;
  bondingCurve: PublicKey;
  slot: number;
  signature: string;
}

export class PumpListener extends EventEmitter {
  private connection: Connection;
  private subId: number | null = null;

  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }

  start(): void {
    console.log("👂  Subscribing to Pump.fun launches…");

    this.subId = this.connection.onLogs(
      PUMP_PROGRAM,
      async (logs, ctx) => {
        // Quick filter: only process if logs contain "initialize"
        if (!logs.logs.some((l) => l.includes("initialize"))) return;
        if (logs.err) return;

        try {
          await this.parseLaunch(logs.signature, ctx.slot);
        } catch {
          // Silently skip parse errors — spam is expected
        }
      },
      "confirmed"
    );
  }

  stop(): void {
    if (this.subId !== null) {
      this.connection.removeOnLogsListener(this.subId);
      this.subId = null;
    }
  }

  private async parseLaunch(sig: string, slot: number): Promise<void> {
    const tx = await this.connection.getParsedTransaction(sig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx?.transaction?.message?.instructions) return;

    for (const ix of tx.transaction.message.instructions) {
      if (!("programId" in ix)) continue;
      const partialIx = ix as PartiallyDecodedInstruction;
      if (!partialIx.programId.equals(PUMP_PROGRAM)) continue;
      if (!partialIx.accounts || partialIx.accounts.length < 3) continue;

      // Pump.fun create instruction layout:
      // accounts[0] = mint
      // accounts[1] = mintAuthority (pump global)
      // accounts[2] = bondingCurve
      // accounts[3] = associatedBondingCurve
      // accounts[4] = global
      // accounts[5] = mplTokenMetadata
      // ...
      const mint = partialIx.accounts[0];
      const bondingCurve = partialIx.accounts[2];

      if (!mint || !bondingCurve) continue;

      const event: LaunchEvent = { mint, bondingCurve, slot, signature: sig };
      this.emit("launch", event);
      return; // Only one create per tx
    }
  }
}
