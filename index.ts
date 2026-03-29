/**
 * Pump.fun Sniper Bot
 *
 * Listens for new Pump.fun token launches via WebSocket.
 * For each launch:
 *   1. Filter: age, liquidity
 *   2. Buy via Jito bundle
 *   3. Monitor price → sell at TP or SL
 */

import { Connection } from "@solana/web3.js";
import { loadConfig } from "./config";
import { PumpListener } from "./pumpListener";
import { filterToken } from "./filter";
import { SwapExecutor } from "./executor";
import { PositionManager } from "./positionManager";

async function main() {
  const config = loadConfig();

  console.log("🎯  Pump.fun Sniper starting…");
  console.log(`   Wallet  : ${config.wallet.publicKey.toBase58()}`);
  console.log(`   Buy     : ${config.buyAmountSol} SOL per snipe`);
  console.log(`   TP      : ${config.takeProfitMultiplier}x`);
  console.log(`   SL      : ${config.stopLossMultiplier}x`);
  console.log(`   Min liq : ${config.minLiquiditySol} SOL`);
  console.log(`   Max age : ${config.maxTokenAgeSlots} slots`);
  console.log(`   Jito tip: ${config.jitoTipLamports} lamports\n`);

  const connection = new Connection(config.rpcUrl, {
    commitment: "confirmed",
    wsEndpoint: config.wsUrl,
  });

  const executor = new SwapExecutor(connection, config);
  const positions = new PositionManager(connection, config);
  const listener = new PumpListener(connection);

  // Track mints we've already processed to avoid double-snipe
  const processed = new Set<string>();

  listener.on("launch", async (event) => {
    const mintKey = event.mint.toBase58();
    if (processed.has(mintKey)) return;
    processed.add(mintKey);

    console.log(
      `\n🚀  New launch: ${mintKey.slice(0, 8)}… | slot: ${event.slot} | sig: ${event.signature.slice(0, 12)}…`
    );

    // Filter
    const filterResult = await filterToken(connection, event, config);
    if (!filterResult.pass) {
      console.log(`  ⏭️  Skipped: ${filterResult.reason}`);
      return;
    }
    console.log(
      `  ✅ Filter passed | liq: ${filterResult.liquiditySol?.toFixed(2)} SOL | age: ${(filterResult.currentSlot ?? 0) - event.slot} slots`
    );

    // Derive associatedBondingCurve (ATA of bondingCurve for the mint)
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const associatedBondingCurve = getAssociatedTokenAddressSync(
      event.mint,
      event.bondingCurve,
      true // allowOwnerOffCurve = true for PDA owners
    );

    // Buy
    console.log(`  🛒  Buying ${config.buyAmountSol} SOL worth…`);
    const position = await executor.buy(
      event.mint,
      event.bondingCurve,
      associatedBondingCurve
    );

    if (position) {
      positions.add(position);
    }

    // Cleanup old processed entries to avoid unbounded growth
    if (processed.size > 1000) {
      const iter = processed.values();
      for (let i = 0; i < 500; i++) processed.delete(iter.next().value);
    }
  });

  listener.start();
  positions.start(2000);

  console.log("👂  Listening for launches…\n");

  // Graceful shutdown
  process.on("SIGINT", () => {
    console.log("\n🛑  Shutting down…");
    listener.stop();
    positions.stop();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
