/**
 * PositionManager
 *
 * Tracks open positions and polls the bonding curve price.
 * Triggers sell via SwapExecutor when TP or SL is hit.
 *
 * Bonding curve price approximation:
 *   The pump.fun bonding curve account stores:
 *     virtualTokenReserves (u64) at offset 8
 *     virtualSolReserves  (u64) at offset 16
 *   Price in SOL per token = virtualSolReserves / virtualTokenReserves
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SniperConfig } from "./config";
import { Position, SwapExecutor } from "./executor";

interface BondingCurveState {
  virtualTokenReserves: bigint;
  virtualSolReserves: bigint;
  realTokenReserves: bigint;
  realSolReserves: bigint;
  tokenTotalSupply: bigint;
  complete: boolean;
}

function parseBondingCurve(data: Buffer): BondingCurveState {
  // Anchor discriminator = 8 bytes, then fields
  const offset = 8;
  return {
    virtualTokenReserves: data.readBigUInt64LE(offset),
    virtualSolReserves: data.readBigUInt64LE(offset + 8),
    realTokenReserves: data.readBigUInt64LE(offset + 16),
    realSolReserves: data.readBigUInt64LE(offset + 24),
    tokenTotalSupply: data.readBigUInt64LE(offset + 32),
    complete: data[offset + 40] === 1,
  };
}

function calcPriceSol(state: BondingCurveState): number {
  if (state.virtualTokenReserves === 0n) return 0;
  return (
    Number(state.virtualSolReserves) /
    LAMPORTS_PER_SOL /
    (Number(state.virtualTokenReserves) / 1e6)
  );
}

export class PositionManager {
  private positions: Map<string, Position> = new Map();
  private executor: SwapExecutor;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(
    private connection: Connection,
    private config: SniperConfig
  ) {
    this.executor = new SwapExecutor(connection, config);
  }

  add(position: Position): void {
    const key = position.mint.toBase58();
    this.positions.set(key, position);
    console.log(
      `📋  Position opened: ${key.slice(0, 8)}… | buy: ${position.buyPriceSol} SOL | tokens: ${position.tokenAmount}`
    );
  }

  start(pollMs: number = 2000): void {
    this.intervalId = setInterval(() => this.tick(), pollMs);
  }

  stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
  }

  private async tick(): Promise<void> {
    for (const [key, position] of this.positions.entries()) {
      try {
        await this.checkPosition(key, position);
      } catch (err) {
        console.error(`  ⚠️  Position check error for ${key.slice(0, 8)}:`, err);
      }
    }
  }

  private async checkPosition(key: string, position: Position): Promise<void> {
    const accountInfo = await this.connection.getAccountInfo(
      position.bondingCurve,
      "confirmed"
    );

    if (!accountInfo) {
      console.log(`  ⚠️  Bonding curve gone for ${key.slice(0, 8)} — selling`);
      await this.closePosition(key, position, "curve-gone");
      return;
    }

    const state = parseBondingCurve(Buffer.from(accountInfo.data));

    if (state.complete) {
      console.log(`  🎓  Token graduated to Raydium — selling ${key.slice(0, 8)}`);
      await this.closePosition(key, position, "graduated");
      return;
    }

    const currentPrice = calcPriceSol(state);
    const buyPrice = position.buyPriceSol / Number(position.tokenAmount) * 1e6;
    const multiplier = buyPrice > 0 ? currentPrice / buyPrice : 1;

    console.log(
      `  📊  ${key.slice(0, 8)}… | price: ${currentPrice.toFixed(8)} SOL/token | mult: ${multiplier.toFixed(2)}x`
    );

    if (multiplier >= this.config.takeProfitMultiplier) {
      console.log(`  🎯  TP hit at ${multiplier.toFixed(2)}x — selling`);
      await this.closePosition(key, position, "take-profit");
    } else if (multiplier <= this.config.stopLossMultiplier) {
      console.log(`  🛑  SL hit at ${multiplier.toFixed(2)}x — selling`);
      await this.closePosition(key, position, "stop-loss");
    }
  }

  private async closePosition(
    key: string,
    position: Position,
    reason: string
  ): Promise<void> {
    this.positions.delete(key);
    const success = await this.executor.sell(position);
    console.log(
      `  ${success ? "✅" : "❌"} Position closed (${reason}): ${key.slice(0, 8)}…`
    );
  }

  get openCount(): number {
    return this.positions.size;
  }
}
