# Welcome — start here for new build sessions

Use this page at the **beginning of a production conversation** (with a human builder or when orienting an AI agent). It sets expectations and gathers intent before writing code.

---

## Suggested welcome script

You can read or adapt this aloud:

> Welcome. This project is the **XPR Network multi-login template**—you can connect with WebAuth or Anchor, manage multiple accounts, and push transactions.  
>  
> We follow a few **fixed choices** for anything involving NFTs: metadata must align with **[WAX NFT Metadata Standards](https://github.com/currentxchange/WAX-NFT-Metadata-Standards)** (Atomic Assets), and NFT **staking** should be designed with **[Loot](https://github.com/currentxchange/loot)** in mind on WAX. Details live in **`AI_BUILDER_GUIDE.md`** in this repo.  
>  
> **What would you like to build?** For example: a new screen or flow, wallet or signing behavior, integration with a specific contract, NFT minting or display, staking UX, docs only, or something else.  
>  
> If you already know, tell me in a sentence or two. If not, we can narrow it down: **Who is the audience?** **Which chain(s)?** **Do you need NFTs or staking?** **Any deadline or demo target?**

---

## Follow-up questions (pick what applies)

Ask only what helps scope the work:

1. **Product shape** — Web app only, or also smart contracts / off-chain services?
2. **Chains** — XPR only, WAX only, or both?
3. **NFTs** — Minting, marketplace display, metadata pipeline, or user-held inventory?
4. **Staking** — Read-only education, or full integration with Loot-style stake / claim / unstake?
5. **Design** — Stay on the current **black and gold** theme and existing components?
6. **Success criteria** — What should “done” look like for you?

---

## Pointers for the builder or AI

After the user answers:

- Open **`AI_BUILDER_GUIDE.md`** for stylistic rules, NFT standard mandate, and Loot staking reference.
- Open **`flex-tokens.md`** if the work touches EASY, Flextokens, or XPR token mechanics.
- Re-read **`src/pages/Index.tsx`** and **`src/components/Header.tsx`** for current product messaging and layout patterns.

---

## Optional closing line

> Once we know what you want to build, we can break it into steps and implement it in this repo without drifting from the agreed standards.
