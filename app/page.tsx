"use client";

import React, { useEffect, useMemo, useState } from "react";

type Finish = "mirror" | "glass" | "wood";
type BarOption = 0 | 2 | 3;

const PRICE = {
  base: 850, // BASE = doors + running gear + fitting (NO interior, NO exterior)
  extraDoor: 400,
  upgradeGlass: 120,
  upgradeWood: 150,
  decorativeBar: 20,
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
  // Door count rules by opening width (min doors, max doors = min + 1)
  if (widthMm >= 800 && widthMm <= 2399) return { minDoors: 2, maxDoors: 3, label: "800–2399mm" };
  if (widthMm >= 2400 && widthMm <= 3599) return { minDoors: 3, maxDoors: 4, label: "2400–3599mm" };
  if (widthMm >= 3600 && widthMm <= 4799) return { minDoors: 4, maxDoors: 5, label: "3600–4799mm" };
  if (widthMm >= 4800 && widthMm <= 5199) return { minDoors: 5, maxDoors: 6, label: "4800–5199mm" };
  return { minDoors: 0, maxDoors: 0, label: "Out of range" };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function finishLabel(f: Finish) {
  if (f === "mirror") return "Mirror (Standard)";
  if (f === "glass") return `Coloured Glass (+${money(PRICE.upgradeGlass)} / door)`;
  return `Wood Finish (+${money(PRICE.upgradeWood)} / door)`;
}

function finishSwatchClass(f: Finish) {
  if (f === "mirror") return "bg-gradient-to-br from-slate-200 to-slate-400";
  if (f === "glass") return "bg-gradient-to-br from-sky-200 to-sky-500";
  return "bg-gray-400";
}

function barLabel(bars: BarOption) {
  if (bars === 0) return "No decorative bars";
  return `${bars} horizontal bars (+${money(bars * PRICE.decorativeBar)})`;
}

export default function Page() {
  // Start BLANK (no prefilled measurements)
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

  // Start blank too; we’ll set it automatically once width is valid
  const [doors, setDoors] = useState<number>(0);
  const [submitState, setSubmitState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [submitMessage, setSubmitMessage] = useState<string>("");

  // When width becomes valid, automatically set doors to the MIN for that band (not max)
  useEffect(() => {
    if (band.minDoors === 0) {
      setDoors(0);
      return;
    }
    setDoors((prev) => {
      // If empty/invalid previously, or outside range, set to min
      if (!prev || prev < band.minDoors || prev > band.maxDoors) return band.minDoors;
      // otherwise keep whatever user already picked
      return prev;
    });
  }, [band.minDoors, band.maxDoors]);

  // Optional items
  const [includeInterior, setIncludeInterior] = useState<boolean>(false);
  const [includeExterior, setIncludeExterior] = useState<boolean>(false);
  const heightRequiresExterior = typeof height === "number" && height >= 2485;

  useEffect(() => {
    if (heightRequiresExterior) setIncludeExterior(true);
  }, [heightRequiresExterior]);

  // Per-door finishes
  const [doorFinishes, setDoorFinishes] = useState<Finish[]>([]);

  // Per-door decorative bars
  const [doorBars, setDoorBars] = useState<BarOption[]>([]);

  // Resize finishes array when door count changes
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

  // Resize bars array when door count changes
  useEffect(() => {
    setDoorBars((prev) => {
      const next = [...prev];
      if (doors <= 0) return [];
      if (doors > next.length) {
        for (let i = next.length; i < doors; i++) next.push(0);
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
    for (const f of doorFinishes) {
      if (f === "mirror") mirror++;
      else if (f === "glass") glass++;
      else wood++;
    }
    return { mirror, glass, wood };
  }, [doorFinishes]);

  const price = useMemo(() => {
    if (doors <= 0) {
      return { extraDoorsCost: 0, upgradesCost: 0, barsCost: 0, interiorCost: 0, exteriorCost: 0, total: 0 };
    }

    const extraDoorsCost = Math.max(0, doors - 2) * PRICE.extraDoor;
    const upgradesCost = counts.glass * PRICE.upgradeGlass + counts.wood * PRICE.upgradeWood;
    const barsCost = doorBars.reduce((sum: number, bars) => sum + (bars * PRICE.decorativeBar), 0);
    
    // Interior cost increases for wider openings (>=4000mm)
    const interiorPrice = includeInterior ? (widthNumber >= 4000 ? 550 : PRICE.interior) : 0;
    const interiorCost = interiorPrice;
    const exteriorCost = includeExterior ? PRICE.exterior : 0;

    const total = PRICE.base + extraDoorsCost + upgradesCost + barsCost + interiorCost + exteriorCost;

    return { extraDoorsCost, upgradesCost, barsCost, interiorCost, exteriorCost, total };
  }, [doors, counts, doorBars, includeInterior, includeExterior, widthNumber]);

  const showQuote = !outOfRange && doors > 0;

    // --- Bedroom wall preview sizing ---
  const PREVIEW = {
    wallMaxW: 400, // px (max width of the wall on screen on mobile, scales up on larger screens)
    wallMinW: 250, // px (min width of the wall on screen)
    wallMaxH: 320, // px (max wall height)
    wallMinH: 220, // px (min wall height)
    widthRange: { min: 800, max: 5199 },
    heightRange: { min: 1800, max: 3000 },
  } as const;

  const wallDims = useMemo(() => {
    // If width/height not entered yet, use a sensible default preview size
    const w = Number.isFinite(widthNumber) ? widthNumber : 0;
    const h = typeof height === "number" ? height : 0;

    const wRatio =
      w > 0
        ? (clamp(w, PREVIEW.widthRange.min, PREVIEW.widthRange.max) - PREVIEW.widthRange.min) /
          (PREVIEW.widthRange.max - PREVIEW.widthRange.min)
        : 0.35;

    const hRatio =
      h > 0
        ? (clamp(h, PREVIEW.heightRange.min, PREVIEW.heightRange.max) - PREVIEW.heightRange.min) /
          (PREVIEW.heightRange.max - PREVIEW.heightRange.min)
        : 0.55;

    const wallW = Math.round(PREVIEW.wallMinW + wRatio * (PREVIEW.wallMaxW - PREVIEW.wallMinW));
    const wallH = Math.round(PREVIEW.wallMinH + hRatio * (PREVIEW.wallMaxH - PREVIEW.wallMinH));

    // Doors all of wall height, with a no headroom
    const doorTopGap = 0; // px
    const skirting = 0; // px
    const doorH = Math.max(140, wallH - doorTopGap - skirting);

    return { wallW, wallH, doorH, doorTopGap, skirting };
  }, [widthNumber, height, PREVIEW.widthRange.min, PREVIEW.widthRange.max, PREVIEW.heightRange.min, PREVIEW.heightRange.max]);

  
  return (
    <div className="min-h-screen overflow-x-hidden text-neutral-50">
      <div className="mx-auto max-w-5xl px-3 sm:px-4 py-6 sm:py-10">
        <div className="relative flex flex-col gap-2 pl-5">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shadow-[0_0_18px_rgba(245,158,11,0.7)]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -left-2 top-0 h-full w-[10px] bg-gradient-to-b from-amber-200/10 via-amber-400/20 to-amber-700/10 blur-[8px]"
          />
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Sliding Wardrobe Price Estimator</h1>
          <p className="text-sm sm:text-base text-neutral-300">
            Instant guide price based on your opening size and per-door finish selection. Final pricing is confirmed after
            a free home design visit.
          </p>
        </div>

        <div className="mt-6 sm:mt-8 grid gap-5 sm:gap-8 lg:gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          {/* LEFT: Inputs */}
          <div className="rounded-2xl border-2 border-amber-400/50 bg-transparent p-4 sm:p-5 md:p-7">
            <h2 className="text-base sm:text-lg font-semibold">1) Your Opening</h2>

            <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <label className="grid gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm text-neutral-300">Opening width (mm)</span>
                <input
                  className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-base text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                  type="number"
                  min={800}
                  max={5199}
                  step={1}
                  value={width}
                  onChange={(e) => {
                    const v = e.target.value;
                    setWidth(v === "" ? "" : parseInt(v, 10));
                  }}
                  placeholder="e.g. 4100"
                />
                <span className="text-xs text-neutral-400">Supported range: 800–5199mm</span>
              </label>

              <label className="grid gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm text-neutral-300">Opening height (mm)</span>
                <input
                  className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-base text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                  type="number"
                  min={1800}
                  max={3000}
                  step={1}
                  value={height}
                  onChange={(e) => {
                    const v = e.target.value;
                    setHeight(v === "" ? "" : parseInt(v, 10));
                  }}
                  placeholder="e.g. 2400"
                />
                {heightRequiresExterior && (
                  <span className="text-xs text-red-400">*this height requires exterior framework*</span>
                )}
              </label>
            </div>

            <div className="mt-6 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <p className="text-xs sm:text-sm text-neutral-300">
                    Door band for{" "}
                    <span className="font-semibold text-neutral-50">
                      {typeof width === "number" ? `${width}mm` : "—"}
                    </span>
                  </p>
                  <p className="text-sm sm:text-base font-semibold">{outOfRange ? "Enter a valid width to continue" : band.label}</p>
                </div>

                {!outOfRange && (
                  <p className="text-xs sm:text-sm text-neutral-300">
                    Min <span className="font-semibold text-neutral-50">{band.minDoors}</span> / Max{" "}
                    <span className="font-semibold text-neutral-50">{band.maxDoors}</span>
                  </p>
                )}
              </div>
            </div>

            <h2 className="mt-8 text-base sm:text-lg font-semibold">2) Door Count</h2>

            <div className="mt-4 grid gap-2">
              <span className="text-xs sm:text-sm text-neutral-300">Number of sliding doors</span>
              <select
                className="appearance-none rounded-lg border-2 border-amber-400/50 bg-gradient-to-br from-neutral-900/40 to-neutral-950/60 px-2.5 py-1.5 text-sm sm:text-base text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/40 disabled:opacity-50 hover:bg-gradient-to-br hover:from-neutral-900/40 hover:to-neutral-950/60 focus:bg-gradient-to-br focus:from-neutral-900/40 focus:to-neutral-950/60 active:bg-gradient-to-br active:from-neutral-900/40 active:to-neutral-950/60"
                style={{
                  backgroundImage: "linear-gradient(to bottom right, rgba(15,23,42,0.4), rgba(2,6,23,0.6))",
                  backgroundColor: "rgba(2,6,23,0.6)",
                  color: "#E6E7E8",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                }}
                value={doors || ""}
                onChange={(e) => setDoors(parseInt(e.target.value, 10))}
                disabled={outOfRange}
              >
                <option value="" disabled>
                  Select…
                </option>
                {doorOptions.map((d) => (
                  <option key={d} value={d}>
                    {d} doors
                  </option>
                ))}
              </select>

              {outOfRange ? (
                <p className="text-sm text-amber-200">Enter a width between 800–5199mm to enable door options.</p>
              ) : (
                <p className="text-sm text-neutral-400">Defaults to the minimum door count for your width band.</p>
              )}
            </div>

            <h2 className="mt-8 text-base sm:text-lg font-semibold">3) Configure Each Door</h2>

            {/* Bedroom wall preview */}
            <div className="mt-4 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <p className="text-sm text-neutral-300">Bedroom wall preview</p>
                <p className="text-xs text-neutral-400">
                  {typeof width === "number" ? `${width}mm` : "—"} w • {typeof height === "number" ? `${height}mm` : "—"} h
                </p>
              </div>

              <div className="mt-3 flex justify-center overflow-x-auto">
                <div
                  className={`relative overflow-hidden rounded-none max-w-full ${
                    includeExterior ? "border-8 border-white" : "border-2 border-amber-400/50"
                  }`}
                  style={{ width: `min(100%, ${wallDims.wallW}px)`, height: wallDims.wallH }}
                >
                  {/* Wall background */}
                  <div className="absolute inset-0 bg-gradient-to-b from-neutral-900/40 to-neutral-950/40" />

                  {/* Subtle vignette */}
                  <div className="absolute inset-0 shadow-[inset_0_0_60px_rgba(0,0,0,0.45)]" />

                  {/* Skirting / floor line removed so doors reach the bottom */}

                  {/* Doors */}
                  {doors > 0 && !outOfRange ? (
                    <div
                      className="absolute left-0 right-0 grid gap-0"
                      style={{
                          top: 0,
                          bottom: 0,
                          gridTemplateColumns: `repeat(${doors}, minmax(0, 1fr))`,
                        }}
                    >
                      {doorFinishes.map((f, i) => (
                        <div
                          key={i}
                          className="relative overflow-hidden h-full border-2 border-amber-400/60 rounded-none"
                        >
                          {/* Door finish fill */}
                          {f === "glass" ? (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage:
                                  "linear-gradient(90deg,#d8cac0 0%,#c4b5a8 40%,#b8a898 60%,#aa9985 100%)",
                                backgroundSize: `100% 100%`,
                                backgroundPosition: `center center`,
                              }}
                            />
                          ) : f === "wood" ? (
                            <div
                              className="absolute inset-0"
                              style={{
                                backgroundImage:
                                  "linear-gradient(90deg,#a89068 0%,#9d855f 100%)",
                                backgroundSize: `100% 100%`,
                                backgroundPosition: `center center`,
                              }}
                            />
                          ) : (
                            <div className={`absolute inset-0 ${finishSwatchClass(f)}`} />
                          )}

                          {/* Door frame effect */}
                          <div className="absolute inset-0 shadow-[inset_0_0_0_2px_rgba(0,0,0,0.25)]" />

                          {/* Decorative bars - split door into equal sections */}
                          {doorBars[i] && doorBars[i] > 0 && (
                            <div className="absolute inset-0 flex flex-col px-1">
                              {Array.from({ length: doorBars[i] }).map((_, barIdx) => {
                                // Calculate position to split door into equal sections
                                // 2 bars: 33.33% and 66.66% (3 sections)
                                // 3 bars: 25%, 50%, 75% (4 sections)
                                const totalSections = doorBars[i] + 1;
                                const barPosition = ((barIdx + 1) / totalSections) * 100;
                                return (
                                  <div
                                    key={barIdx}
                                    className="absolute w-full h-[2px] bg-neutral-900/40 rounded-full left-0"
                                    style={{ top: `${barPosition}%`, transform: "translateY(-50%)" }}
                                  />
                                );
                              })}
                            </div>
                          )}

                          {/* Split line / meeting stile */}
                          <div className="absolute right-0 top-0 h-full w-[2px] bg-neutral-900/30" />

                          {/* Small label */}
                          <div className="absolute bottom-1 left-1 right-1 rounded-md bg-neutral-950/50 px-2 py-1 text-center text-[11px] text-neutral-100">
                            Door {i + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-neutral-300">
                      Enter a valid width, then select door count to preview against a wall.
                    </div>
                  )}
                </div>
              </div>

              <p className="mt-3 text-xs text-neutral-400">
                This is a visual guide only — proportions are scaled for screen preview.
              </p>
            </div>
         
            <div className="mt-4 grid gap-3">
              {doorFinishes.map((f, idx) => (
                <div
                  key={idx}
                  className="flex flex-col gap-2 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-semibold">Door {idx + 1}</p>
                    <p className="text-xs text-neutral-400">Choose the finish for this door.</p>
                  </div>

                  <select
                    className="appearance-none w-full rounded-lg border-2 border-amber-400/50 bg-gradient-to-br from-neutral-900/40 to-neutral-950/60 px-2.5 py-1.5 text-sm sm:text-base text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/40 sm:w-full hover:bg-gradient-to-br hover:from-neutral-900/40 hover:to-neutral-950/60 focus:bg-gradient-to-br focus:from-neutral-900/40 focus:to-neutral-950/60 active:bg-gradient-to-br active:from-neutral-900/40 active:to-neutral-950/60"
                    style={{
                      backgroundImage: "linear-gradient(to bottom right, rgba(15,23,42,0.4), rgba(2,6,23,0.6))",
                      backgroundColor: "rgba(2,6,23,0.6)",
                      color: "#E6E7E8",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                    }}
                    value={f}
                    onChange={(e) => {
                      const next = [...doorFinishes];
                      next[idx] = e.target.value as Finish;
                      setDoorFinishes(next);
                    }}
                  >
                    <option value="mirror">{finishLabel("mirror")}</option>
                    <option value="glass">{finishLabel("glass")}</option>
                    <option value="wood">{finishLabel("wood")}</option>
                  </select>

                  <select
                    className="appearance-none w-full rounded-lg border-2 border-amber-400/50 bg-gradient-to-br from-neutral-900/40 to-neutral-950/60 px-2.5 py-1.5 text-sm sm:text-base text-neutral-100 outline-none focus:ring-2 focus:ring-amber-400/40 sm:w-full hover:bg-gradient-to-br hover:from-neutral-900/40 hover:to-neutral-950/60 focus:bg-gradient-to-br focus:from-neutral-900/40 focus:to-neutral-950/60 active:bg-gradient-to-br active:from-neutral-900/40 active:to-neutral-950/60"
                    style={{
                      backgroundImage: "linear-gradient(to bottom right, rgba(15,23,42,0.4), rgba(2,6,23,0.6))",
                      backgroundColor: "rgba(2,6,23,0.6)",
                      color: "#E6E7E8",
                      WebkitAppearance: "none",
                      MozAppearance: "none",
                    }}
                    value={doorBars[idx]}
                    onChange={(e) => {
                      const next = [...doorBars];
                      next[idx] = parseInt(e.target.value, 10) as BarOption;
                      setDoorBars(next);
                    }}
                  >
                    <option value="0">{barLabel(0)}</option>
                    <option value="2">{barLabel(2)}</option>
                    <option value="3">{barLabel(3)}</option>
                  </select>
                </div>
              ))}
            </div>

            <h2 className="mt-8 text-base sm:text-lg font-semibold">4) Interior & Exterior</h2>

            <div className="mt-4 grid gap-3">
              <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
                <div>
                  <p className="text-sm font-semibold">Popular Interior Layout</p>
                  <p className="text-xs text-neutral-400">Adds a practical, popular layout inside the wardrobe which includes {widthNumber >= 4000 ? "2 x shelving units" : "1 x shelving unit"}, 1 x 18" deep top shelf and an assortment of hanging rails.</p>
                  <p className="mt-1 text-xs text-neutral-200">+{money(widthNumber >= 4000 ? 550 : PRICE.interior)}</p>
                </div>
                <input
                  type="checkbox"
                  checked={includeInterior}
                  onChange={(e) => setIncludeInterior(e.target.checked)}
                  className="h-5 w-5 accent-amber-400 mt-2 sm:mt-0"
                />
              </label>



              <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
                <div>
                  <p className="text-sm font-semibold">Exterior Frame</p>
                  <p className="text-xs text-neutral-400">Adds the exterior frame for a fully built-in finish.</p>
                  <p className="mt-1 text-xs text-neutral-200">+{money(PRICE.exterior)}</p>
                </div>
                <input
                  type="checkbox"
                  checked={includeExterior}
                  onChange={(e) => setIncludeExterior(e.target.checked)}
                  disabled={heightRequiresExterior}
                  className="h-5 w-5 accent-amber-400 mt-2 sm:mt-0"
                />
              </label>
            </div>

            <div className="mt-6 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 text-xs sm:text-sm text-neutral-300">
              <p className="font-semibold text-neutral-50">What this guide price includes</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Base price (doors & running gear): {money(PRICE.base)}</li>
                <li>Extra doors: +{money(PRICE.extraDoor)} each over 2</li>
                <li>Coloured glass upgrade: +{money(PRICE.upgradeGlass)} per door</li>
                <li>Wood finish upgrade: +{money(PRICE.upgradeWood)} per door</li>
                <li>Decorative bars: +{money(PRICE.decorativeBar)} per bar</li>
                <li>Optional interior layout: +{money(PRICE.interior)}</li>
                <li>Optional exterior frame: +{money(PRICE.exterior)}</li>
              </ul>
            </div>
          </div>

          {/* RIGHT: Summary */}
          <div className="rounded-2xl border-2 border-amber-400/50 bg-transparent p-4 sm:p-5 md:p-7 h-fit sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-auto">
            <h2 className="text-lg font-semibold">Your Guide Price</h2>

            <div className="mt-4 rounded-2xl bg-transparent p-5">
              <p className="text-sm text-neutral-300">Estimated guide price</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight">{showQuote ? money(price.total) : "—"}</p>
              <p className="mt-2 text-sm text-neutral-400">
                Final pricing is confirmed after a free home design visit to check walls, floors and layout.
              </p>

              {showQuote && (
                <div className="mt-5 grid gap-2 text-sm">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Base (doors & running gear)</span>
                    <span className="text-neutral-50">{money(PRICE.base)}</span>
                  </div>

                  {price.interiorCost > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Interior layout</span>
                      <span className="text-neutral-50">{money(price.interiorCost)}</span>
                    </div>
                  )}

                  {price.exteriorCost > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Exterior frame</span>
                      <span className="text-neutral-50">{money(price.exteriorCost)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Extra doors</span>
                    <span className="text-neutral-50">{money(price.extraDoorsCost)}</span>
                  </div>

                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Finish upgrades</span>
                    <span className="text-neutral-50">{money(price.upgradesCost)}</span>
                  </div>

                  {price.barsCost > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Decorative bars</span>
                      <span className="text-neutral-50">{money(price.barsCost)}</span>
                    </div>
                  )}

                  <div className="my-2 h-px bg-neutral-800" />

                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{money(price.total)}</span>
                  </div>

                  <div className="mt-4 rounded-xl border-2 border-amber-400/50 bg-transparent p-3">
                    <p className="text-xs text-neutral-300">
                      Finish breakdown:{" "}
                      <span className="font-semibold text-neutral-50">{counts.mirror}</span> mirror,{" "}
                      <span className="font-semibold text-neutral-50">{counts.glass}</span> coloured glass,{" "}
                      <span className="font-semibold text-neutral-50">{counts.wood}</span> wood.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <h3 className="mt-6 text-base font-semibold">Request a Free Home Design Visit</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Leave your details and we’ll get back to arrange a no-obligation home design visit.
            </p>

            <form
              className="mt-4 grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitState === "submitting") return;

                const form = e.currentTarget;
                const formData = new FormData(form);
                const name = String(formData.get("name") || "").trim();
                const postcode = String(formData.get("postcode") || "").trim();
                const contact = String(formData.get("contact") || "").trim();

                if (!name || !postcode || !contact) {
                  setSubmitState("error");
                  setSubmitMessage("Please complete all fields before submitting.");
                  return;
                }

                setSubmitState("submitting");
                setSubmitMessage("");

                try {
                  const guidePrice = showQuote
                    ? {
                        width: typeof width === "number" ? width : null,
                        height: typeof height === "number" ? height : null,
                        doors,
                        finishCounts: counts,
                        includeInterior,
                        includeExterior,
                        breakdown: {
                          base: PRICE.base,
                          extraDoors: price.extraDoorsCost,
                          upgrades: price.upgradesCost,
                          bars: price.barsCost,
                          interior: price.interiorCost,
                          exterior: price.exteriorCost,
                        },
                        total: price.total,
                      }
                    : null;

                  const res = await fetch("/api/request-visit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name, postcode, contact, guidePrice }),
                  });

                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || "Unable to submit request. Please try again.");
                  }

                  setSubmitState("success");
                  setSubmitMessage("Thanks! We will be in touch shortly to arrange your visit.");
                  form.reset();
                } catch (err) {
                  setSubmitState("error");
                  setSubmitMessage(err instanceof Error ? err.message : "Unable to submit request. Please try again.");
                }
              }}
            >
              <input
                className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Name"
                name="name"
              />
              <input
                className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Postcode"
                name="postcode"
              />
              <input
                className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Mobile / Email"
                name="contact"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:opacity-60"
                disabled={submitState === "submitting"}
              >
                {submitState === "submitting" ? "Sending..." : "Request Visit"}
              </button>
              {submitMessage && (
                <p
                  className={`text-xs ${submitState === "success" ? "text-amber-200" : "text-amber-300"}`}
                  role="status"
                  aria-live="polite"
                >
                  {submitMessage}
                </p>
              )}
              <p className="text-xs text-neutral-400">
                This quote is a guide only. We’ll confirm final spec and pricing after measuring and checking the room.
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
