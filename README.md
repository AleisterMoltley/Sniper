# 🎯 Pump.fun Sniper Bot

### *A rootin'-tootin' Solana token sniper that catches them new Pump.fun launches quicker'n a coonhound on a scent trail*

---

## What In Tarnation Is This Thing?

Well I'll be darned, partner — this here contraption is a **Pump.fun Sniper Bot** fer the Solana blockchain. It sits there listenin' real hard to the blockchain, and the second some new-fangled token pops up on Pump.fun, it jumps on it faster'n a frog on a June bug.

Here's what this ol' thing does:

1. **Listens** — Hooks into Solana's WebSocket like an ol' hound dog with its ear to the ground, watchin' fer new Pump.fun token launches
2. **Filters** — Ain't no fool neither — checks if the token's got enough liquidity and ain't too old 'fore it commits
3. **Buys** — Sends a buy order through them fancy Jito bundles, quick as lightnin'
4. **Manages** — Keeps an eye on yer positions like a hawk, and sells when ya hit yer take-profit or stop-loss

---

## Project Files — What's In The Barn

| File | What It Does, Y'all |
|---|---|
| `index.ts` | The main honcho — fires everythin' up and ties it all together |
| `pumpListener.ts` | The lookout — subscribes to Solana logs and hollers when a new Pump.fun token gets birthed |
| `executor.ts` | The trigger finger — builds and fires off buy/sell orders through Jito bundles |
| `positionManager.ts` | The bookkeeper — tracks yer open positions and decides when to cash out |
| `filter.ts` | The bouncer — checks token age and liquidity 'fore lettin' it through |
| `config.ts` | The settings shed — loads up all yer configuration from environment variables |
| `jito.ts` | The mail carrier — builds versioned transactions and ships 'em off to the Jito block engine |
| `.env.example` | A sample of them environment variables ya need to fill in |

---

## How This Whole Hoedown Works

```
                    ┌──────────────────┐
                    │   Solana Chain    │
                    │   (WebSocket)     │
                    └────────┬─────────┘
                             │ new Pump.fun log
                             ▼
                    ┌──────────────────┐
                    │  PumpListener    │
                    │  (pumpListener)  │
                    └────────┬─────────┘
                             │ "launch" event
                             ▼
                    ┌──────────────────┐
                    │     Filter       │  ← Too old? Not enough liquidity?
                    │    (filter)      │    Git on outta here!
                    └────────┬─────────┘
                             │ passed
                             ▼
                    ┌──────────────────┐
                    │  SwapExecutor    │  ← Buy via Jito bundle
                    │   (executor)     │
                    └────────┬─────────┘
                             │ position opened
                             ▼
                    ┌──────────────────┐
                    │ PositionManager  │  ← Polls price every 2s
                    │(positionManager) │    Sells at TP or SL
                    └──────────────────┘
```

---

## Gettin' Started — Settin' Up Yer Still

### Prerequisites (What Ya Need 'Fore Ya Start)

- **Node.js** (v18 or newer — don't bring no antique to a gunfight)
- **npm** or **yarn** (fer wranglin' them packages)
- A **Solana wallet** with some SOL in it (can't hunt with an empty gun)
- A **Solana RPC endpoint** with WebSocket support (Helius, QuickNode, or whatever suits yer fancy — free RPCs ain't gonna cut it, they rate-limit `onLogs` harder'n a mule kicks)

### Step 1: Clone This Here Repo

```bash
git clone https://github.com/AleisterMoltley/Sniper.git
cd Sniper
```

### Step 2: Wrangle Them Dependencies

```bash
npm install
```

Ya gonna need these packages (put 'em in yer `package.json` if they ain't there already):

```bash
npm install @solana/web3.js @solana/spl-token bs58 dotenv
npm install -D typescript @types/node ts-node
```

### Step 3: Set Up Yer Environment (Fill In The Blanks)

Copy that there example file and fill in yer own dang secrets:

```bash
cp .env.example .env
```

Now open up `.env` with yer favorite text wrangler and fill it in:

```env
# REQUIRED — ain't goin' nowhere without these
RPC_URL=https://your-rpc-endpoint.com
WALLET_PRIVATE_KEY=your_base58_private_key_here

# OPTIONAL — but good fer fine-tunin'
WS_URL=wss://your-rpc-endpoint.com        # WebSocket URL (defaults to yer RPC with wss://)
BUY_AMOUNT_SOL=0.01                        # How much SOL to throw at each token
TAKE_PROFIT_MULT=2.0                       # Sell when price doubles (2x)
STOP_LOSS_MULT=0.5                         # Bail out if price drops 50%
MIN_LIQUIDITY_SOL=5                        # Don't touch tokens with less'n 5 SOL in the curve
MAX_TOKEN_AGE_SLOTS=5                      # Ignore tokens older'n 5 slots
JITO_BLOCK_ENGINE_URL=https://mainnet.block-engine.jito.wtf
JITO_TIP_LAMPORTS=50000                    # Tip fer the Jito validators (be generous, ya cheapskate)
JITO_TIP_ACCOUNT=96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5
```

### Step 4: Fire It Up

```bash
npx ts-node index.ts
```

If everythin's hooked up right, you'll see somethin' like:

```
🎯  Pump.fun Sniper starting…
   Wallet  : YourWa11etAddr3ssH3re...
   Buy     : 0.01 SOL per snipe
   TP      : 2x
   SL      : 0.5x
   Min liq : 5 SOL
   Max age : 5 slots
   Jito tip: 50000 lamports

👂  Listening for launches…
```

Now sit back in yer rockin' chair and let the bot do its thing!

---

## Configuration — Tweakin' The Moonshine Recipe

| Variable | Default | What It Means, City Slicker |
|---|---|---|
| `RPC_URL` | *required* | Yer Solana RPC endpoint — the pipeline to the blockchain |
| `WALLET_PRIVATE_KEY` | *required* | Yer wallet's private key in base58 — guard this like yer grandpappy's shotgun |
| `WS_URL` | auto from RPC | WebSocket URL fer real-time updates |
| `BUY_AMOUNT_SOL` | `0.01` | How much SOL to spend on each snipe |
| `TAKE_PROFIT_MULT` | `2.0` | Multiplier to trigger a sell (2.0 = double yer money) |
| `STOP_LOSS_MULT` | `0.5` | Multiplier to cut losses (0.5 = lost half, time to skedaddle) |
| `MAX_TOKEN_AGE_SLOTS` | `5` | How many slots old a token can be 'fore we ignore it (~2 seconds) |
| `MIN_LIQUIDITY_SOL` | `5` | Minimum SOL in the bonding curve — no penny-ante games |
| `JITO_TIP_LAMPORTS` | `10000` | Tip fer Jito validators — greases the wheels (~$0.008) |
| `JITO_TIP_ACCOUNT` | Jito default | Where the tip goes |
| `JITO_BLOCK_ENGINE_URL` | `https://mainnet.block-engine.jito.wtf` | The Jito block engine — leave it be unless ya know what yer doin' |

---

## RPC Providers — Where To Git Yer Pipeline

**Ya need a premium RPC with WebSocket support.** Them free ones rate-limit ya harder'n a Sunday sermon.

| Provider | Cost | Notes |
|---|---|---|
| **Helius** (helius.dev) | ~$49/mo | Best fer Pump.fun — fast as a rattlesnake |
| **Triton** (triton.one) | Enterprise | Heavy-duty, fer the big ranchers |
| **QuickNode** | Varies | Reliable ol' workhorse |

---

## Budget Tips — Snipin' On A Shoestring

If yer workin' with less'n $100 (we ain't all oil barons 'round here):

- Keep `BUY_AMOUNT_SOL` at `0.01` (~$1.50 per snipe)
- Set `TAKE_PROFIT_MULT` to `1.5` (take them profits quicker)
- Set `STOP_LOSS_MULT` to `0.6` (tighter stop-loss, less bleedin')
- Expect roughly a 30% win rate on Pump.fun tokens
- One good 3x hit on a $1.50 buy = +$3 profit after fees — that's a good day of fishin'!

---

## Shuttin' Her Down

Just hit `Ctrl+C` and she'll shut down graceful-like. The bot catches that `SIGINT` signal and tidies up 'fore closin' the barn door.

---

## ⚠️ Risks — Don't Say I Didn't Warn Ya

1. **Rug pulls** — The token creator can yank all the liquidity out faster'n you can say "dadgummit." Stop-loss helps, but it can't save ya from an instant rug.
2. **MEV competition** — Other snipers out there are fast too. A premium RPC and a fatter Jito tip help ya stay ahead of the pack.
3. **RPC costs** — That Helius subscription eats into a small budget. Try the free tier first to kick the tires.
4. **Bonding curve graduation** — When a token graduates to Raydium, the bot's smart enough to sell automatically. No worries there, it's handled.
5. **General crypto risk** — This here market's wilder than a buckin' bronco. Only put in what ya can afford to lose.

---

## ⚠️ Disclaimer

- **This here bot trades REAL money.** Don't go puttin' in more'n you can afford to lose, ya hear?
- **Crypto tradin' is riskier than wrestlin' a gator.** You could lose everythin'.
- **Keep yer private key secret** — don't go showin' it off at the county fair.
- **Start small** — use tiny amounts (like 0.01 SOL) 'til you get the hang of it.
- **This is fer educational purposes.** The code's provided as-is, no warranties, no guarantees, no refunds at the general store.

---

*Built with ❤️ and a jug of moonshine somewhere out in the holler* 🏔️
