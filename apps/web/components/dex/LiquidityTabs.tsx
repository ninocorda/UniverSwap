"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

const AddLiquidityCard = dynamic(() => import("./AddLiquidityCard"), { ssr: false });
const CreatePoolCard = dynamic(() => import("./CreatePoolCard"), { ssr: false });

export default function LiquidityTabs() {
  const [tab, setTab] = useState<"add" | "create">("add");
  return (
    <div>
      <div className="mb-4 inline-flex rounded-lg border border-white/10 bg-black/40 p-1">
        <button
          onClick={() => setTab("add")}
          className={`rounded-md px-3 py-1 text-sm ${tab === "add" ? "bg-white/10" : "hover:bg-white/5"}`}
        >Add Liquidity</button>
        <button
          onClick={() => setTab("create")}
          className={`rounded-md px-3 py-1 text-sm ${tab === "create" ? "bg-white/10" : "hover:bg-white/5"}`}
        >Create a Pool</button>
      </div>
      <div>
        {tab === "add" ? <AddLiquidityCard /> : <CreatePoolCard />}
      </div>
    </div>
  );
}
