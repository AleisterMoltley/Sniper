# Pump.fun Sniper Bot

Listens for new Pump.fun token launches via WebSocket and snipes them atomically via Jito bundles.

## Architecture

```
PumpListener  →  onLogs(PUMP_PROGRAM)  →  WebSocket
     ↓
filterToken   →  age check + liquidity check
     ↓
SwapExecutor  →  buy via Jito bundle
     ↓
PositionManager  →  poll price every 2s
     ↓
SwapExecutor  →  sell at TP or SL via Jito bundle
```

## Setup

```bash
yarn install
cp .env.example .env
# Edit .env
yarn dev
```

## Key params (.env)

| Var | Default | Notes |
|-----|---------|-------|
| `BUY_AMOUNT_SOL` | 0.01 | SOL per snipe. With $50 budget → ~5 SOL → 500 snipes |
| `TAKE_PROFIT_MULT` | 2.0 | Sell at 2x. Pump.fun 10x is rare, 2x is realistic |
| `STOP_LOSS_MULT` | 0.5 | Sell at -50%. Cuts rug losses |
| `MIN_LIQUIDITY_SOL` | 5 | Skip dead launches with no SOL |
| `MAX_TOKEN_AGE_SLOTS` | 5 | ~2 seconds. Be first or skip |
| `JITO_TIP_LAMPORTS` | 50000 | ~$0.008. Increase if missing bundles |

## RPC Requirements

**You need a premium RPC with WebSocket support.**
Free RPCs rate-limit `onLogs` subscriptions heavily.

Recommended:
- Helius (helius.dev) — $49/mo, best for Pump.fun
- Triton (triton.one) — enterprise grade
- QuickNode — reliable fallback

## With <$100 budget

- Keep `BUY_AMOUNT_SOL` at `0.01` (≈$1.50)
- Set `TAKE_PROFIT_MULT` to `1.5` (faster exits)
- Set `STOP_LOSS_MULT` to `0.6` (tighter SL)
- Expect ~30% win rate on pump.fun tokens
- One 3x hit on a $1.50 buy = +$3 profit after fees

## Risks

1. **Rugs**: Token creator drains liquidity instantly. SL helps but can't protect from instant rugs.
2. **MEV competition**: Other snipers are faster. Premium RPC + higher Jito tip helps.
3. **RPC cost**: Helius $49/mo eats into <$100 budget. Use free tier first to test.
4. **Bonding curve graduation**: Token migrates to Raydium mid-position (handled — bot sells automatically).
