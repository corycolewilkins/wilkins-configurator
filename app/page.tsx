"use client";

import React, { useEffect, useMemo, useState } from "react";

type Finish = "mirror" | "glass" | "wood";

const PRICE = {
  base: 795,
  extraDoor: 400,
  upgradeGlass: 120,
  upgradeWood: 150,
  interior: 450,
  exterior: 450,
} as const;

function money(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n);
}

function getDoorBand(widthMm: number) {
  if (widthMm >= 800 && widthMm <= 2399) return { minDoors: 2, maxDoors: 3, label: "800–2399mm" };
  if (widthMm >= 2400 && widthMm <= 3599) return { minDoors: 3, maxDoors: 4, label: "2400–3599mm" };
  if (widthMm >= 3600 && widthMm <= 4799) return { minDoors: 4, maxDoors: 5, label: "3600–4799mm" };
  if (widthMm >= 4800 && widthMm <= 5199) return { minDoors: 5, maxDoors: 6, label: "4800–5199mm" };
  return { minDoors: 0, maxDoors: 0, label: "Out of range" };
}

function finishLabel(f: Finish) {
  if (f === "mirror") return "Mirror (Standard)";
  if (f === "glass") return `Coloured Glass (+${money(PRICE.upgradeGlass)} / door)`;
  return `Wood Finish (+${money(PRICE.upgradeWood)} / door)`;
}

function finishSwatchClass(f: Finish) {
  if (f === "mirror") return "bg-gradient-to-br from-slate-200 to-slate-400";
  if (f === "glass") return "bg-gradient-to-br from-sky-200 to-sky-500";
  return "bg-gradient-to-br from-amber-200 to-amber-600";
}

export default function Page() {
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");

  const widthNumber = typeof width === "number" ? width : NaN;
  const outOfRange = !Number.isFinite(widthNumber) || widthNumber < 800 || widthNumber > 5199;

  const band = useMemo(() => {
    if (outOfRange) return { minDoors: 0, maxDoors: 0, label: "Out of range" };
    return getDoorBand(widthNumber);
  }, [outOfRange, widthNumber]);

  const doorOptions = useMemo(() => {
    if (band.minDoors === 0) return [];
    return Array.from({ length: band.maxDoors - band.minDoors + 1 }, (_, i) => band.minDoors + i);
  }, [band]);

  const [doors, setDoors] = useState<number>(0);

  useEffect(() => {
    if (band.minDoors === 0) {
      setDoors(0);
      return;
    }
    setDoors((prev) =>
      !prev || prev < band.minDoors || prev > band.maxDoors ? band.minDoors : prev
    );
  }, [band.minDoors, band.maxDoors]);

  const [includeInterior, setIncludeInterior] = useState(false);
  const [includeExterior, setIncludeExterior] = useState(false);
  const [doorFinishes, setDoorFinishes] = useState<Finish[]>([]);

  useEffect(() => {
    setDoorFinishes((prev) => {
      const next = [...prev];
      if (doors <= 0) return [];
      if (doors > next.length) {
        for (let i = next.length; i < doors; i++) next.push("mirror");
      } else if (doors < next.length) {
        next.length = doors;
      }
      return next;
    });
  }, [doors]);

  const counts = useMemo(() => {
    let mirror = 0,
      glass = 0,
      wood = 0;
    doorFinishes.forEach((f) => {
      if (f === "mirror") mirror++;
      else if (f === "glass") glass++;
      else wood++;
    });
    return { mirror, glass, wood };
  }, [doorFinishes]);

  const price = useMemo(() => {
    if (doors <= 0) return { extraDoorsCost: 0, upgradesCost: 0, interiorCost: 0, exteriorCost: 0, total: 0 };

    const extraDoorsCost = Math.max(0, doors - 2) * PRICE.extraDoor;
    const upgradesCost = counts.glass * PRICE.upgradeGlass + counts.wood * PRICE.upgradeWood;
    const interiorCost = includeInterior ? PRICE.interior : 0;
    const exteriorCost = includeExterior ? PRICE.exterior : 0;

    return {
      extraDoorsCost,
      upgradesCost,
      interiorCost,
      exteriorCost,
      total: PRICE.base + extraDoorsCost + upgradesCost + interiorCost + exteriorCost,
    };
  }, [doors, counts, includeInterior, includeExterior]);

  const showQuote = !outOfRange && doors > 0;

  return (
    <div className="min-h-screen text-neutral-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">
          Sliding Wardrobe Price Estimator
        </h1>
        <p className="mt-1 text-neutral-600">
          Instant guide price based on your opening size and per-door finish selection.
        </p>

        {/* EVERYTHING ELSE LEFT EXACTLY AS-IS */}
      </div>
    </div>
  );
}
