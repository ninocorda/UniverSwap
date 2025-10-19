#!/usr/bin/env bash
set -euo pipefail

echo "[SMOKE] Universwap aggregator smoke test (BSC Testnet 97)"

# 1) Pick RPC endpoint: env override or public fallback
RPC="${NEXT_PUBLIC_BSC_TESTNET_RPC:-}"
if [[ -z "$RPC" ]]; then
  # Public fallback (subject to rate limits). Prefer env for reliability.
  RPC="https://data-seed-prebsc-1-s1.binance.org:8545/"
fi
echo "[SMOKE] Using RPC: $RPC"

fail() { echo "[SMOKE][FAIL] $1" >&2; exit 1; }

# Helper to do JSON-RPC POST via curl
rpc() {
  local method="$1"; shift
  local params="$1"; shift || true
  curl -sS -H 'Content-Type: application/json' -X POST "$RPC" \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"$method\",\"params\":${params:-[]}}"
}

# 2) Check chainId == 0x61 (97)
echo "[SMOKE] Checking chainId..."
CID_JSON=$(rpc eth_chainId []) || fail "RPC eth_chainId request failed"
CID=$(echo "$CID_JSON" | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')
[[ -z "$CID" ]] && fail "No chainId result returned"
echo "[SMOKE] chainId: $CID"
[[ "$CID" != "0x61" ]] && fail "Expected chainId 0x61 (97)"

# 3) Fetch latest block number
echo "[SMOKE] Fetching latest block number..."
BLK_JSON=$(rpc eth_blockNumber []) || fail "RPC eth_blockNumber request failed"
BLK=$(echo "$BLK_JSON" | sed -n 's/.*"result":"\([^"]*\)".*/\1/p')
[[ -z "$BLK" ]] && fail "No block number returned"
echo "[SMOKE] Latest block: $BLK"

echo "[SMOKE][OK] RPC health looks good."
echo "[SMOKE] Next: run the web app, select BSC Testnet (97), and try quotes (e.g., WBNB->BUSD, WBNB->CAKE)."
