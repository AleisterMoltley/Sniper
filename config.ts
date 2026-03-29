import { Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import * as dotenv from "dotenv";
dotenv.config();

export interface SniperConfig {
  rpcUrl: string;
  wsUrl: string;
  wallet: Keypair;
  // How much SOL to spend per snipe (in SOL, e.g. 0.01)
  buyAmountSol: number;
  // Sell when price multiplies by this factor (e.g. 2 = 2x)
  takeProfitMultiplier: number;
  // Sell if price drops below this fraction of buy price (e.g. 0.5 = -50%)
  stopLossMultiplier: number;
  // Max age of token in slots before we ignore it
  maxTokenAgeSlots: number;
  // Jito
  jitoBlockEngineUrl: string;
  jitoTipLamports: number;
  jitoTipAccount: PublicKey;
  // Min liquidity in SOL to consider a token
  minLiquiditySol: number;
  // Raydium AMM program
  raydiumAmmProgram: PublicKey;
}

const required = (key: string): string => {
  const val = process.env[key];
  if (!val) throw new Error(`Missing env var: ${key}`);
  return val;
};

const optional = (key: string, fallback: string): string =>
  process.env[key] ?? fallback;

export function loadConfig(): SniperConfig {
  const privateKey = required("WALLET_PRIVATE_KEY");
  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

  return {
    rpcUrl: required("RPC_URL"),
    wsUrl: optional("WS_URL", required("RPC_URL").replace("https", "wss")),
    wallet,
    buyAmountSol: parseFloat(optional("BUY_AMOUNT_SOL", "0.01")),
    takeProfitMultiplier: parseFloat(optional("TAKE_PROFIT_MULT", "2.0")),
    stopLossMultiplier: parseFloat(optional("STOP_LOSS_MULT", "0.5")),
    maxTokenAgeSlots: parseInt(optional("MAX_TOKEN_AGE_SLOTS", "5"), 10),
    jitoBlockEngineUrl: optional(
      "JITO_BLOCK_ENGINE_URL",
      "https://mainnet.block-engine.jito.wtf"
    ),
    jitoTipLamports: parseInt(optional("JITO_TIP_LAMPORTS", "10000"), 10),
    jitoTipAccount: new PublicKey(
      optional(
        "JITO_TIP_ACCOUNT",
        "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5"
      )
    ),
    minLiquiditySol: parseFloat(optional("MIN_LIQUIDITY_SOL", "5")),
    raydiumAmmProgram: new PublicKey(
      optional(
        "RAYDIUM_AMM_PROGRAM",
        "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
      )
    ),
  };
}
