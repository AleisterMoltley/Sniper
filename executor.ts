/**
 * SwapExecutor
 *
 * Executes buy and sell orders on the Pump.fun bonding curve via Jito bundles.
 *
 * Pump.fun bonding curve buy instruction:
 *   Discriminator: [102, 6, 61, 18, 1, 218, 235, 234]  (buy)
 *   Args: amount (u64), maxSolCost (u64)
 *
 * Pump.fun bonding curve sell instruction:
 *   Discriminator: [51, 230, 133, 164, 1, 127, 131, 173]  (sell)
 *   Args: amount (u64), minSolOutput (u64)
 */

import {
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { SniperConfig } from "./config";
import { buildVersionedTx, buildTipInstruction, submitBundle } from "./jito";

// Pump.fun constants
export const PUMP_PROGRAM = new PublicKey(
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
);
const PUMP_GLOBAL = new PublicKey(
  "4wTV1YmiEkRvAtNtsSGPtUrqRYQMe5zP9QkDrRi7HrTF"
);
const PUMP_FEE_ACCOUNT = new PublicKey(
  "CebN5WGQ4jvEPvsVU4EoHEpgznyZtCqhrfs6gHYABVMK"
);
const PUMP_EVENT_AUTHORITY = new PublicKey(
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1"
);

// Discriminators
const BUY_DISCRIMINATOR = Buffer.from([102, 6, 61, 18, 1, 218, 235, 234]);
const SELL_DISCRIMINATOR = Buffer.from([51, 230, 133, 164, 1, 127, 131, 173]);

function encodeU64(value: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(value);
  return buf;
}

export async function buildBuyInstruction(
  buyer: PublicKey,
  mint: PublicKey,
  bondingCurve: PublicKey,
  associatedBondingCurve: PublicKey,
  buyerAta: PublicKey,
  solAmount: number,
  slippageBps: number = 500 // 5% default
): Promise<TransactionInstruction> {
  // Amount in lamports
  const lamports = BigInt(Math.floor(solAmount * LAMPORTS_PER_SOL));
  // maxSolCost with slippage
  const maxSolCost = (lamports * BigInt(10000 + slippageBps)) / BigInt(10000);

  const data = Buffer.concat([
    BUY_DISCRIMINATOR,
    encodeU64(lamports), // token amount — pump uses SOL amount here
    encodeU64(maxSolCost),
  ]);

  return new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: buyerAta, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export async function buildSellInstruction(
  seller: PublicKey,
  mint: PublicKey,
  bondingCurve: PublicKey,
  associatedBondingCurve: PublicKey,
  sellerAta: PublicKey,
  tokenAmount: bigint,
  minSolOutput: bigint
): Promise<TransactionInstruction> {
  const data = Buffer.concat([
    SELL_DISCRIMINATOR,
    encodeU64(tokenAmount),
    encodeU64(minSolOutput),
  ]);

  return new TransactionInstruction({
    programId: PUMP_PROGRAM,
    keys: [
      { pubkey: PUMP_GLOBAL, isSigner: false, isWritable: false },
      { pubkey: PUMP_FEE_ACCOUNT, isSigner: false, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: bondingCurve, isSigner: false, isWritable: true },
      { pubkey: associatedBondingCurve, isSigner: false, isWritable: true },
      { pubkey: sellerAta, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export interface Position {
  mint: PublicKey;
  bondingCurve: PublicKey;
  associatedBondingCurve: PublicKey;
  ata: PublicKey;
  buyPriceSol: number;
  tokenAmount: bigint;
  slot: number;
}

export class SwapExecutor {
  constructor(
    private connection: Connection,
    private config: SniperConfig
  ) {}

  async buy(
    mint: PublicKey,
    bondingCurve: PublicKey,
    associatedBondingCurve: PublicKey
  ): Promise<Position | null> {
    const wallet = this.config.wallet;
    const ata = getAssociatedTokenAddressSync(mint, wallet.publicKey);

    // Check if ATA exists, if not create it
    const ataInfo = await this.connection.getAccountInfo(ata);
    const instructions: TransactionInstruction[] = [];

    if (!ataInfo) {
      instructions.push(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          ata,
          wallet.publicKey,
          mint
        )
      );
    }

    // Buy instruction
    const buyIx = await buildBuyInstruction(
      wallet.publicKey,
      mint,
      bondingCurve,
      associatedBondingCurve,
      ata,
      this.config.buyAmountSol
    );
    instructions.push(buyIx);

    // Jito tip
    instructions.push(
      buildTipInstruction(
        wallet.publicKey,
        this.config.jitoTipAccount,
        this.config.jitoTipLamports
      )
    );

    const tx = await buildVersionedTx(this.connection, wallet, instructions);

    try {
      const bundleId = await submitBundle([tx], this.config);
      console.log(`  ✅ Buy bundle submitted: ${bundleId}`);

      // Wait for confirmation and get token balance
      await new Promise((r) => setTimeout(r, 3000));
      const tokenBalance = await this.connection.getTokenAccountBalance(ata);
      const tokenAmount = BigInt(tokenBalance.value.amount);

      const currentSlot = await this.connection.getSlot("confirmed");

      return {
        mint,
        bondingCurve,
        associatedBondingCurve,
        ata,
        buyPriceSol: this.config.buyAmountSol,
        tokenAmount,
        slot: currentSlot,
      };
    } catch (err) {
      console.error(`  ❌ Buy failed:`, err);
      return null;
    }
  }

  async sell(position: Position, slippageBps: number = 1000): Promise<boolean> {
    const wallet = this.config.wallet;

    // minSolOutput = 0 for now (market sell, slippage handled by pump curve)
    // Could calculate expected output from bonding curve math
    const minSolOutput = BigInt(0);

    const sellIx = await buildSellInstruction(
      wallet.publicKey,
      position.mint,
      position.bondingCurve,
      position.associatedBondingCurve,
      position.ata,
      position.tokenAmount,
      minSolOutput
    );

    const tipIx = buildTipInstruction(
      wallet.publicKey,
      this.config.jitoTipAccount,
      this.config.jitoTipLamports
    );

    const tx = await buildVersionedTx(this.connection, wallet, [sellIx, tipIx]);

    try {
      const bundleId = await submitBundle([tx], this.config);
      console.log(`  ✅ Sell bundle submitted: ${bundleId}`);
      return true;
    } catch (err) {
      console.error(`  ❌ Sell failed:`, err);
      return false;
    }
  }
}
