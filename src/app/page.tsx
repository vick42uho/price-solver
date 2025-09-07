"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

/**********************
 * Next.js App Router
 * File: app/page.tsx
 * Stack: Tailwind + shadcn/ui
 * Notes: Hydration-safe (fixed locale formatters, no hook-order issues)
 **********************/

// Regression equations (from user):
// 1) Gold vs BTC:   Gold = -0.000007 * BTC + 1784.21
// 2) Silver vs BTC: Silver = -0.000015 * BTC + 23.14
// 3) Silver vs Gold: Silver = 0.0135 * Gold - 0.51

// Symbols: G = Gold (USD/oz), S = Silver (USD/oz), B = BTC (USD)

type Asset = "G" | "S" | "B";
type PairKey = `${Asset}|${Asset}`;

type HistoryItem = {
  ts: number;
  given: Asset;
  target: Asset;
  input: number;
  result: number;
  precision: number;
  fx: number; // USD->THB used at calculation time
};

const STORAGE_KEY = "price-solver-history-v1";

const units: Record<Asset, string> = { G: "USD/oz", S: "USD/oz", B: "USD" };
const labels: Record<Asset, string> = { G: "Gold (XAU)", S: "Silver (XAG)", B: "Bitcoin (BTC)" };

// Fixed formatters (avoid SSR/CSR locale drift)
const numFmt = (min = 0, max = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: true });
const dateFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "short", timeStyle: "medium" });

// Core conversion
function compute(target: Asset, given: Asset, value: number): number | null {
  if (Number.isNaN(value)) return null;
  switch (`${target}|${given}` as PairKey) {
    case "G|B": return -0.000007 * value + 1784.21; // Gold from BTC
    case "G|S": return (value + 0.51) / 0.0135;    // Gold from Silver
    case "S|B": return -0.000015 * value + 23.14;  // Silver from BTC
    case "S|G": return 0.0135 * value - 0.51;      // Silver from Gold
    case "B|G": return (1784.21 - value) / 0.000007; // BTC from Gold
    case "B|S": return (23.14 - value) / 0.000015;   // BTC from Silver
    default: return null; // same-asset pair not allowed
  }
}

const unitOf = (a: Asset) => units[a];
const labelOf = (a: Asset) => labels[a];

export default function Page() {
  // Declare ALL hooks first to keep order stable across renders
  const [givenAsset, setGivenAsset] = useState<Asset>("B");
  const [targetAsset, setTargetAsset] = useState<Asset>("G");
  const [input, setInput] = useState<string>("");
  const [precision, setPrecision] = useState<string>("2");
  const [fx, setFx] = useState<string>("35.00");
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Client-only effects (safe on hydration)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setHistory(JSON.parse(raw));
    } catch { }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-100)));
    } catch { }
  }, [history]);

  const parsed = Number.parseFloat(input);
  const parsedFx = Number.parseFloat(fx) || 0;

  const result = useMemo(() => {
    if (!input) return null;
    if (Number.isNaN(parsed)) return null;
    if (givenAsset === targetAsset) return null;
    return compute(targetAsset, givenAsset, parsed);
  }, [input, parsed, givenAsset, targetAsset]);

  const rounded = useMemo(() => {
    if (result == null) return null;
    const p = Math.max(0, Math.min(8, Number.parseInt(precision) || 2));
    return { n: Number(result.toFixed(p)), p };
  }, [result, precision]);

  const thb = useMemo(() => (rounded ? (parsedFx > 0 ? rounded.n * parsedFx : null) : null), [rounded, parsedFx]);

  const addToHistory = (val: number) => {
    const p = Math.max(0, Math.min(8, Number.parseInt(precision) || 2));
    setHistory((h) => [...h, { ts: Date.now(), given: givenAsset, target: targetAsset, input: parsed, result: val, precision: p, fx: parsedFx }]);
  };

  const onSave = () => { if (rounded?.n != null) addToHistory(rounded.n); };
  const swap = () => { setTargetAsset(givenAsset); setGivenAsset(targetAsset); };

  return (
    <main className="min-h-dvh bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Gold • Silver • BTC <span className="text-primary">Price Solver</span>
          </h1>

        </div>

        <Tabs defaultValue="calc" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="calc">คำนวณ</TabsTrigger>
            <TabsTrigger value="history">ประวัติ</TabsTrigger>
          </TabsList>

          <TabsContent value="calc">
            <Card className="border-border/60 shadow-sm">
              <CardHeader>
                <CardTitle>แปลงราคา (Cross‑Asset)</CardTitle>
                <CardDescription>
                  เลือก &quot;ฉันมีราคา&quot; → กรอกค่า → เลือก &quot;อยากได้ราคา&quot; ระบบจะคิดให้อัตโนมัติ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>ฉันมีราคา (Given)</Label>
                    <Select value={givenAsset} onValueChange={(v) => setGivenAsset(v as Asset)}>
                      <SelectTrigger><SelectValue placeholder="เลือกสินทรัพย์" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="G">{labelOf("G")}</SelectItem>
                        <SelectItem value="S">{labelOf("S")}</SelectItem>
                        <SelectItem value="B">{labelOf("B")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>อยากได้ราคา (Target)</Label>
                    <Select value={targetAsset} onValueChange={(v) => setTargetAsset(v as Asset)}>
                      <SelectTrigger><SelectValue placeholder="เลือกสินทรัพย์" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="G" disabled={givenAsset === "G"}>{labelOf("G")}</SelectItem>
                        <SelectItem value="S" disabled={givenAsset === "S"}>{labelOf("S")}</SelectItem>
                        <SelectItem value="B" disabled={givenAsset === "B"}>{labelOf("B")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <PresetRow asset={givenAsset} onPick={(v) => setInput(String(v))} />

                <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
                  <div className="space-y-2">
                    <Label>กรอกราคา {labelOf(givenAsset)} ({unitOf(givenAsset)})</Label>
                    <Input inputMode="decimal" placeholder={`เช่น 65000 สำหรับ BTC หรือ 1900 สำหรับ Gold`} value={input} onChange={(e) => setInput(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>ทศนิยม</Label>
                    <Select value={precision} onValueChange={setPrecision}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["0", "1", "2", "3", "4", "5"].map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
                  <div className="space-y-2">
                    <Label>อัตราแลกเปลี่ยน USD → THB</Label>
                    <Input inputMode="decimal" placeholder="เช่น 35.00" value={fx} onChange={(e) => setFx(e.target.value)} />
                  </div>
                  <div className="flex gap-2 md:justify-end">
                    <Button type="button" variant="secondary" onClick={swap}>สลับสินทรัพย์</Button>
                    <Badge variant="secondary" className="self-center">หน่วย: {unitOf(targetAsset)}</Badge>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>ผลลัพธ์</Label>
                  <ResultPanel result={rounded?.n ?? null} target={targetAsset} precision={rounded?.p ?? 2} thb={thb} fx={parsedFx} />
                  <div className="flex gap-2">
                    <Button type="button" onClick={onSave} disabled={rounded?.n == null}>บันทึกเข้า History</Button>
                    <Button type="button" variant="outline" onClick={() => setInput("")}>ล้างค่า</Button>
                  </div>
                </div>
                <Separator />



              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>ประวัติการคำนวณ</CardTitle>
                <CardDescription>บันทึกล่าสุด 100 รายการ (เก็บในเบราว์เซอร์ของคุณ)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setHistory([])}>ล้างประวัติ</Button>
                </div>
                <div className="divide-y rounded-md border">
                  {history.length === 0 && (<div className="p-4 text-sm text-muted-foreground">ยังไม่มีรายการ</div>)}
                  {history.slice().reverse().map((h, i) => (
                    <div key={h.ts + "-" + i} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 text-sm">
                      <div><span className="font-medium">เวลา</span><div>{dateFmt.format(new Date(h.ts))}</div></div>
                      <div><span className="font-medium">Given</span><div>{labels[h.given]}: {numFmt().format(h.input)} {units[h.given]}</div></div>
                      <div><span className="font-medium">Target</span><div>{labels[h.target]}: {numFmt().format(h.result)} {units[h.target]}</div></div>
                      <div><span className="font-medium">USD→THB</span><div>{numFmt().format(h.fx)}</div></div>
                      <div><span className="font-medium">THB</span><div>{h.fx > 0 ? numFmt().format(h.result * h.fx) : "–"}</div></div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>


      </div>
    </main>
  );
}

function fmt(n: number, p = 2) { return numFmt(0, p).format(n); }

function ResultPanel({ result, target, precision, thb, fx }: { result: number | null; target: Asset; precision: number; thb: number | null; fx: number; }) {
  if (result == null) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-6 text-muted-foreground">กรอกข้อมูลด้านบนเพื่อดูผลลัพธ์</CardContent>
      </Card>
    );
  }
  const unit = unitOf(target);
  const label = labelOf(target);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg">{label}</CardTitle>
        <CardDescription>คำนวณด้วยความละเอียด {precision} ตำแหน่ง</CardDescription>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        <div className="text-3xl md:text-4xl font-semibold tracking-tight">
          {numFmt(precision, precision).format(result)}
          <span className="ml-2 text-base text-muted-foreground">{unit}</span>
        </div>
        <div className="text-sm text-muted-foreground">
          <span className="font-medium">≈ </span>
          {thb != null && fx > 0 ? (
            <>
              {numFmt(precision, precision).format(thb)}
              <span className="ml-1">THB</span>
              <span className="ml-2">(ที่อัตรา {numFmt(0, 2).format(fx)})</span>
            </>
          ) : (
            <span>กรอกอัตราแลกเปลี่ยนเพื่อแสดงเป็น THB</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function PresetRow({ asset, onPick }: { asset: Asset; onPick: (v: number) => void }) {
  const presets: Record<Asset, number[]> = { B: [30000, 50000, 65000, 100000], G: [1600, 1800, 2000, 2200], S: [15, 20, 25, 30] };
  return (
    <div className="space-y-2">
      <Label>ค่าตัวอย่าง (Presets) สำหรับ {labelOf(asset)}</Label>
      <div className="flex flex-wrap gap-2">
        {presets[asset].map((v) => (
          <Button key={v} type="button" variant="outline" onClick={() => onPick(v)}>
            {numFmt().format(v)} {unitOf(asset)}
          </Button>
        ))}
      </div>
    </div>
  );
}
