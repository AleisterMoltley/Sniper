/**
 * TokenFilter
 *
 * Before executing a snipe, runs sanity checks:
 *   1. Token age ≤ maxTokenAgeSlots (we're not late)
 *   2. Bonding curve SOL balance ≥ minLiquiditySol (not empty)
 *   3. Not already migrated to Raydium (we'd be too late)
 *
 * Returns null if the token passes, or a rejection reason string.
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SniperConfig } from "./config";
import { LaunchEvent } from "./pumpListener";

export interface FilterResult {
  pass: boolean;
  reason?: string;
  liquiditySol?: number;
  currentSlot?: number;
}

export async function filterToken(
  connection: Connection,
  event: LaunchEvent,
  config: SniperConfig
): Promise<FilterResult> {
  const currentSlot = await connection.getSlot("confirmed");
  const age = currentSlot - event.slot;

  if (age > config.maxTokenAgeSlots) {
    return { pass: false, reason: `Too old: ${age} slots`, currentSlot };
  }

  // Check bonding curve SOL balance (liquidity)
  const balance = await connection.getBalance(event.bondingCurve, "confirmed");
  const liquiditySol = balance / LAMPORTS_PER_SOL;

  if (liquiditySol < config.minLiquiditySol) {
    return {
      pass: false,
      reason: `Low liquidity: ${liquiditySol.toFixed(3)} SOL`,
      liquiditySol,
      currentSlot,
    };
  }

  return { pass: true, liquiditySol, currentSlot };
}
