"use client";
import { useEffect } from "react";
import { ChevronRight } from "lucide-react";
import { AppMark } from "../../brand";
import { doMarketTopics } from "../../store";
import { boardOf, loadBoard, useMarket } from "@/lib/market/client";
import { tokenKey } from "@/lib/market/providers";
import { fmtPrice } from "@/lib/wallet/format";
import { APP } from "@/lib/brand";
import { Change, TokenIcon } from "./parts";

/** Home screen widget: the top of Kiteline's trending board */
export function MarketWidget({ onOpen }: { onOpen: (href: string) => void }) {
  useMarket();
  useEffect(() => {
    const b = boardOf("trending");
    if (!b || Date.now() - b.fetchedAt > 60_000) void loadBoard("trending").then(() => { const r = boardOf("trending"); if (r && !r.stale) doMarketTopics(r.data); });
  }, []);
  const rows = boardOf("trending")?.data.slice(0, 3);
  return (
    <div className="mt-3 rounded-2xl bg-surface p-2">
      <button onClick={() => onOpen(APP.trade.route)} className="flex min-h-[44px] w-full items-center gap-2 px-2 text-[13px] font-semibold text-muted"><AppMark app="trade" size={20} />{APP.trade.name} · Trending<ChevronRight className="ml-auto size-4" /></button>
      {!rows && Array.from({ length: 3 }, (_, i) => <div key={i} className="flex h-14 items-center gap-3 px-2"><span className="skeleton size-9 rounded-full" /><span className="skeleton h-3.5 w-24 rounded" /><span className="skeleton ml-auto h-3.5 w-16 rounded" /></div>)}
      {rows?.map((q) => (
        <button key={tokenKey(q)} onClick={() => onOpen(`/trade/t/${q.chain}/${q.address}`)} className="flex min-h-[56px] w-full items-center gap-3 rounded-xl px-2 text-left active:bg-surface-2">
          <TokenIcon symbol={q.symbol} address={q.address} chain={q.chain} size={36} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--header)]">{q.symbol}</span>
          <span className="text-right"><span className="num block text-[14px] font-semibold text-fg">{fmtPrice(q.priceUsd)}</span><Change v={q.change.h24} className="text-[12px]" /></span>
        </button>
      ))}
    </div>
  );
}
