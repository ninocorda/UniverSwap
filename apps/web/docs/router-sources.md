# Router Sources and Verification (BSC)

This document tracks official router/quoter sources for BSC (56 mainnet, 97 testnet) and evidence links (docs + BscScan verified contracts). Only verified addresses should be added to the curated config JSONs.

## Checklist per entry
- Name (DEX)
- Network: 56 (mainnet) / 97 (testnet)
- Contract type: V2 Router / V3 Quoter (or other adapter)
- Address
- Evidence links: Official docs, GitHub, BscScan verified page
- Notes (deprecations, V3/V2 caveats, fee tiers)

## Curated JSONs
- `apps/web/config/v2-routers.bsc.json`
- `apps/web/config/v3-routers.bsc.json`

## Verified entries (filled in curated JSONs)
- PancakeSwap V2 Router (56 mainnet, 97 testnet)
  - Type: V2 Router
  - Address (56): `0x10ED43C718714eb63d5aA57B78B54704E256024E`
  - Address (97): `0x9Ac64Cc6e4415144C455BD8E4837Fea55603e5c3`
  - Evidence: Docs https://developer.pancakeswap.finance/contracts/v2/addresses • BscScan https://bscscan.com/address/0x10ed43c718714eb63d5aa57b78b54704e256024e
  - Notes: Well-known Pancake V2 router

- PancakeSwap V3 QuoterV2 (56 mainnet)
  - Type: V3 QuoterV2 (read-only)
  - Address (56): `0xb048BbC1EE6B733fFfCFb9E9ceF7375518e25997`
  - Evidence: Docs https://developer.pancakeswap.finance/contracts/v3/addresses • BscScan https://bscscan.com/address/0xb048bbc1ee6b733fffcfb9e9cef7375518e25997
  - Notes: QuoterV2 preferred for v3 quoting. Testnet address not listed in official docs.

- ApeSwap V2 Router (56 mainnet)
  - Type: V2 Router (ApeRouter)
  - Address (56): `0xcF0feBd3f17CEf5b47b0cD257aCf6025c5BFf3b7`
  - Evidence: Official docs (archived) https://web.archive.org/web/20240201/https://docs.ape.bond/apeswap-finance/where-dev/smart-contracts (BNB Chain → DEX Contracts)
  - Notes: ApeSwap docs list multiple DEX contract addresses; using ApeRouter as primary.

- Biswap Smart Router (56 mainnet)
  - Type: V2 Router (Smart Router)
  - Address (56): `0x0eB6949e725A295Ecb3BEacFc3766610BC970BEF`
  - Evidence: Official docs https://docs.biswap.org/biswap/general-information/biswap-smart-contracts
  - Notes: Listed explicitly under “Smart Router contract”.

- BabySwap Router (56 mainnet)
  - Type: V2 Router
  - Address (56): `0x325E343f1dE602396E256B67eFd1F61C3A6B38Bd`
  - Evidence: Official docs https://docs.babyswap.finance/developers/smart-contracts (Main contracts → Router)

- JulSwap Router (56 mainnet)
  - Type: V2 Router
  - Address (56): `0xBd67d157502A23309Db761c41965600c2Ec788b2`
  - Evidence: Official GitHub https://github.com/JustLiquidity/julswap-contract (Deployed Contracts)

- THENA RouterV2 (56 mainnet)
  - Type: V2 Router
  - Address (56): `0xd4ae6eca985340dd434d38f470accce4dc78d109`
  - Evidence: Official docs https://docs.thena.fi/thena/official-links → “List of smart contracts” (Google Sheet)
  - Notes: Address provided from official sheet.

- THENA Quoter (Algebra/CL) (56 mainnet)
  - Type: V3-style Quoter (Algebra)
  - Address (56): `0xeA68020D6A9532EeC42D4dB0f92B83580c39b2cA`
  - Evidence: Official docs https://docs.thena.fi/thena/official-links → “List of smart contracts” (Google Sheet)
  - Notes: Algebra quoter; our current v3 adapter targets Uniswap V3 QuoterV2 ABI and may need an Algebra adapter to utilize this.

## Pending entries (to verify and fill)
- Thena Router (56)
- BakerySwap V2 Router (56)
- MDEX Router (56)
- BabySwap Router (56)
- JulSwap Router (56)

Please verify using:
- Official documentation websites
- Official GitHub repositories/releases
- BscScan Verified Contracts with the correct contract name and DEX ownership context

After verification, fill the JSONs with:
- `name`
- `address` (mainnet)
- `testnetAddress` if available, otherwise null
- `sourceLink` (docs/GitHub)
- `notes`
