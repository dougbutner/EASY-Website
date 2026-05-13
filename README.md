# XPR App Forge — Multi-login XPR Network template

A **Vite + React + TypeScript** starter for **XPR Network** dApps with **WebAuth** and **Anchor** wallets, **multiple accounts**, a single **active signer**, and a generic **contract action** form. The repo ships **black-and-gold** UI (shadcn-style components), optional **Flextokens** positioning, a **`skill/`** markdown knowledge pack for XPR / EOSIO topics, and a **smart-contracts** Cursor Agent Skill under **`.agents/skills/smart-contracts/`** that points into **`skill/`** for contract work.

---

## What this project does

- **Connects** users via **WebAuth** (`@proton/web-sdk`) or **Anchor** (WharfKit session + wallet plugin).
- **Remembers several wallets** (per-account storage prefixes + manifest) and lets users **switch the active signer** from the header.
- **Signs transactions** through the active wallet: the home page includes a **TransactionForm** where you enter `contract`, `action`, and JSON `data` to push arbitrary actions to XPR.
- **Routes** with React Router (`/`, catch-all `NotFound`).
- **Themes** with CSS variables in `src/index.css` (Tailwind) for a consistent **dark + gold** look.

It is a **template**, not a finished product: you add screens, business logic, and safer action builders on top of the wallet and transact layer.

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Build | Vite 5 |
| UI | React 18, Tailwind, Radix-based UI in `src/components/ui/` |
| State / server cache | TanStack React Query |
| XPR / Proton | `@proton/web-sdk`, chain config in `walletConstants.ts` |
| Anchor | `@wharfkit/session`, `@wharfkit/wallet-plugin-anchor`, web renderer |
| Routing | `react-router-dom` |
| Tests | Vitest, Testing Library, Playwright (dev dependency) |

---

## Repository layout

```text
├── src/
│   ├── App.tsx                 # Router, providers, Wharf dialog hook
│   ├── main.tsx
│   ├── index.css               # Theme tokens (black / gold)
│   ├── components/
│   │   ├── Header.tsx          # Branding + multi-wallet menu
│   │   ├── TransactionForm.tsx
│   │   └── ui/                 # shadcn-style primitives (button, card, dialog, …)
│   ├── hooks/
│   │   └── useProton.ts        # Wallet list, active id, connect/disconnect, transact
│   ├── pages/
│   │   ├── Index.tsx           # Landing + form + footer
│   │   └── NotFound.tsx
│   ├── services/
│   │   ├── walletConstants.ts  # APP_NAME, REQUEST_ACCOUNT, XPR chain
│   │   ├── walletManifest.ts   # Multi WebAuth session manifest (localStorage)
│   │   ├── walletSessions.ts   # Restore/connect/transact orchestration
│   │   ├── proton.ts           # Proton link / WebAuth helpers
│   │   └── wharfSessionKit.ts  # Anchor / Wharf setup
│   └── lib/utils.ts
├── .agents/skills/smart-contracts/ # Agent Skill: XPR smart contracts → `skill/*.md`
├── .agents/skills/alcor-exchange/  # Agent Skill: Alcor DEX / AMM integration → `skill/alcor-*.md`
├── skill/                      # XPR + ecosystem markdown modules (start at skill/SKILL.md)
├── flex-tokens.md              # Deep reference: Flextokens (EASY, WON, MEME, …)
├── AI_BUILDER_GUIDE.md         # Conventions: UI + WAX NFT metadata + Loot staking
├── Welcome.md                  # Onboarding script / questions for new build sessions
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

---

## Getting started

```bash
# Install (npm; commit package-lock.json — Cloudflare Pages follows the lockfile present in the repo)
npm install

# Dev server
npm run dev

# Production build
npm run build

# Preview build
npm run preview

# Lint / tests
npm run lint
npm run test
```

Point your wallet and RPC endpoints at **XPR mainnet or testnet** as appropriate; chain identifiers live in `src/services/walletConstants.ts`.

---

## Documentation you should know about

| Doc | Purpose |
|-----|---------|
| [`skill/SKILL.md`](skill/SKILL.md) | What the **`skill/`** folder is for; entry to module files. |
| [`.agents/skills/smart-contracts/SKILL.md`](.agents/skills/smart-contracts/SKILL.md) | Cursor Agent Skill for **smart contract** work — links to **`skill/smart-contracts.md`** and safety notes. |
| [`skill/flextokens.md`](skill/flextokens.md) | Flextokens on XPR (contracts, actions, links). |
| [`skill/alcor-exchange.md`](skill/alcor-exchange.md) | Alcor: index + links to split modules (`alcor-swap-amm`, API/WebSocket, orderbook, widgets, overview). |
| [`.agents/skills/alcor-exchange/SKILL.md`](.agents/skills/alcor-exchange/SKILL.md) | Cursor Agent Skill for **Alcor** (not MetalX `dex` API). |
| [`flex-tokens.md`](flex-tokens.md) | Long-form Flextokens reference + explorer links. |
| [`AI_BUILDER_GUIDE.md`](AI_BUILDER_GUIDE.md) | Styling rules + mandatory **WAX NFT metadata** and **Loot** staking references for NFT work. |
| [`Welcome.md`](Welcome.md) | Suggested **first conversation** with a user or AI before a big build. |

---

## Who this is for (use cases)

- **You want a clean XPR dApp shell** with professional wallet UX (multi-account, not only single-session).
- **You are prototyping Flextokens or XPR DeFi** and need a place to call `mon3y`, `xtokens`, or other contracts from a signed-in user.
- **You use Cursor or another AI** and want **grounding files** ([`skill/`](skill/), Flextokens, Alcor; for contracts use [`.agents/skills/smart-contracts/SKILL.md`](.agents/skills/smart-contracts/SKILL.md)) so generated code matches XPR and ecosystem norms.
- **You teach or demo** “connect → pick account → push action” without writing wallet plumbing first.
- **You plan WAX + XPR products** and need one repo that documents **NFT metadata standards** and **staking** expectations alongside the XPR template (`AI_BUILDER_GUIDE.md`).
- **You embed swaps or education** and will link out to [flex.report](https://flex.report) or Alcor using **`https://alcor.exchange/v/xpr/...`** (and **`/v/wax/...`** on WAX when relevant)—prefer those **new** routed URLs over legacy subdomains whenever they work.

---

## Example prompts for common blockchain builds

Use these (or variants) with an AI assistant **in this repo** so it can use **`skill/`** (and the **smart-contracts** skill for on-chain work), `useProton`, and your conventions. Replace names and contracts with yours.

1. **Token balance dashboard**  
   *“Add a page that uses the connected XPR account to fetch and display balances for XPR and selected `xtokens` assets via RPC, with loading and error states. Use the existing `useProton` hook and match the black-and-gold UI.”*

2. **Safe transfer form**  
   *“Build a dedicated transfer form for `eosio.token` `transfer` (to, quantity, memo) that validates inputs and calls `transact` on the active wallet. Do not use the generic JSON form for this path.”*

3. **Flextoken reward flow**  
   *“Using `skill/flextokens.md` and `flex-tokens.md`, add UI that explains how to call `setflextoken` (or the correct action for WON) and a button that opens the explorer action page in a new tab, plus optional transact integration if the action data shape is straightforward.”*

4. **Multi-action transaction**  
   *“Extend the app to accept an array of actions (contract, name, data) and submit them in one `transact` batch, with JSON validation and a clear error display.”*

5. **Read-only contract table browser**  
   *“Create a small tool page: input contract, table, scope, and limit; fetch rows from the public XPR RPC and render them in a table component. No wallet required for reads.”*

6. **Alcor price / markets panel**  
   *“Using `skill/alcor-exchange.md`, add a read-only panel that `fetch`es `GET https://proton.alcor.exchange/api/markets/:id` (or `https://wax.alcor.exchange/api/...` for WAX)—never bare `alcor.exchange/api` for Proton. Deep-link users with **new** URLs: `https://alcor.exchange/v/xpr/...` or `https://alcor.exchange/v/wax/...` (swap, analytics, etc.).”*

7. **New route + layout**  
   *“Add a `/dashboard` route with a shared layout (header wallet menu preserved), placeholder sections for ‘Portfolio’ and ‘Activity’, and navigation between home and dashboard.”*

8. **NFT-facing explainer (WAX standards)**  
   *“Add a static page that summarizes our obligation to use WAX NFT Metadata Standards and Loot for staking, with links from `AI_BUILDER_GUIDE.md`—no on-chain code yet.”*

9. **Account switcher persistence**  
   *“Document and harden behavior when the user has three WebAuth accounts and one Anchor account: ensure active wallet persists across refresh and that transact always uses the selected signer.”*

10. **Contract deployment checklist page**  
   *“Add a developer checklist page that pulls key bullets from `skill/safety-guidelines.md` and `skill/testing-debugging.md` (testnet first, table migrations, review), styled as cards.”*

11. **Memo builder for `swap.alcor`**  
   *“Build a helper that constructs an Alcor AMM transfer memo (`swapexactin` / `swapexactout`) from pool ids, recipient, output asset, and deadline per `skill/alcor-exchange.md`, and copies it to the clipboard.”*

12. **Staking / governance readout**  
   *“Using `skill/staking-governance.md`, add a read-only section that explains XPR staking and voting at a high level and links to official resources—keep copy accurate and concise.”*

---

## Security and responsibility

- Smart contracts and signed transactions move real value. **Review** AI-generated code, **test on testnet**, and follow **`skill/safety-guidelines.md`** before changing or deploying contracts.
- The bundled **TransactionForm** is powerful and **generic**; for production, prefer **narrow, validated** forms per action.

---

## Credits / positioning

Landing copy credits **EASY** and points to **Flextokens** ([flex.report](https://flex.report)). Template positioning is community-driven; verify links and claims for your own deployment.

---

## License

See `package.json` and project root for license files if present. Dependencies retain their respective licenses.
