"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type Finish = "mirror" | "glass" | "wood";
type BarOption = 0 | 2 | 3;
type WardrobeType = "basic" | "fitted";

type QuoteInput = {
  width: number | null;
  height: number | null;
  doors: number;
  doorFinishes: Finish[];
  doorBars: BarOption[];
  includeInterior: boolean;
  includeExterior: boolean;
  wardrobeType: WardrobeType | null;
  supplyOnly: boolean | null;
};

type GuidePrice = {
  width: number | null;
  height: number | null;
  doors: number;
  finishCounts: { mirror: number; glass: number; wood: number };
  includeInterior: boolean;
  includeExterior: boolean;
  breakdown: {
    base: number;
    extraDoors: number;
    upgrades: number;
    bars: number;
    interior: number;
    exterior: number;
  };
  total: number;
};

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// Helper to track GA events
const trackEvent = (eventName: string, eventData?: Record<string, string | number>) => {
  if (typeof window === "undefined") return;

  if (window.gtag) {
    window.gtag("event", eventName, eventData);
  }

  if (window.parent && window.parent !== window) {
    console.log("[Estimator] Sending event to parent:", eventName, eventData);
    window.parent.postMessage(
      { source: "wilkins-estimator", eventName, eventData },
      "*"
    );
  }
};

const OPTION_PRICE = {
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
  if (widthMm >= 800 && widthMm <= 2450) return { minDoors: 2, maxDoors: 3, label: "800–2450mm" };
  if (widthMm >= 2450 && widthMm <= 3600) return { minDoors: 3, maxDoors: 4, label: "2450–3600mm" };
  if (widthMm >= 3600 && widthMm <= 5000) return { minDoors: 4, maxDoors: 6, label: "3600–5000mm" };
  return { minDoors: 0, maxDoors: 0, label: "Out of range" };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function finishLabel(f: Finish) {
  if (f === "mirror") return "Mirror (Standard)";
  if (f === "glass") return "Coloured Glass";
  return "Wood Finish";
}

function finishSwatchClass(f: Finish) {
  if (f === "mirror") return "bg-gradient-to-br from-slate-200 to-slate-400";
  if (f === "glass") return "bg-gradient-to-br from-sky-200 to-sky-500";
  return "bg-gray-400";
}

function barLabel(bars: BarOption) {
  if (bars === 0) return "No decorative bars";
  return `${bars} horizontal bars`;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function Page() {
  // Start BLANK (no prefilled measurements)
  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");

  const widthNumber = typeof width === "number" ? width : NaN;
  const outOfRange = !Number.isFinite(widthNumber) || widthNumber < 800 || widthNumber > 5000;

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
  const [email, setEmail] = useState<string>("");
  const [postcode, setPostcode] = useState<string>("");
  const [revealState, setRevealState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [revealMessage, setRevealMessage] = useState<string>("");
  const [revealUnlocked, setRevealUnlocked] = useState<boolean>(false);
  const [revealedGuidePrice, setRevealedGuidePrice] = useState<GuidePrice | null>(null);
  const [emailQuoteState, setEmailQuoteState] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [emailQuoteMessage, setEmailQuoteMessage] = useState<string>("");

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

  // Wardrobe type
  const [wardrobeType, setWardrobeType] = useState<WardrobeType | null>(null);
  const [supplyOnly, setSupplyOnly] = useState<boolean | null>(null);

  // Optional items
  const [includeInterior, setIncludeInterior] = useState<boolean>(false);
  const [includeExterior, setIncludeExterior] = useState<boolean>(false);
  const heightRequiresExterior = typeof height === "number" && height >= 2485;

  useEffect(() => {
    if (wardrobeType === "fitted") {
      setIncludeInterior(true);
      setIncludeExterior(true);
      setSupplyOnly(false);
    } else {
      setIncludeInterior(false);
      if (!heightRequiresExterior) setIncludeExterior(false);
    }
  }, [wardrobeType, heightRequiresExterior]);

  useEffect(() => {
    if (heightRequiresExterior && wardrobeType === "basic") {
      setIncludeExterior(true);
    }
  }, [heightRequiresExterior, wardrobeType]);

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

  const showQuote = !outOfRange && doors > 0;
  const emailValid = email.trim().length > 0 && isValidEmail(email);
  const revealReady = showQuote && emailValid && postcode.trim().length > 0;
  const quoteInput = useMemo<QuoteInput | null>(() => {
    if (!showQuote) return null;
    return {
      width: typeof width === "number" ? width : null,
      height: typeof height === "number" ? height : null,
      doors,
      doorFinishes,
      doorBars,
      includeInterior,
      includeExterior,
      wardrobeType,
      supplyOnly,
    };
  }, [showQuote, width, height, doors, doorFinishes, doorBars, includeInterior, includeExterior, wardrobeType, supplyOnly]);
  const revealQuote = revealReady && revealUnlocked && !!revealedGuidePrice;
  const quoteSignature = useMemo(
    () =>
      JSON.stringify({
        width,
        height,
        doors,
        includeInterior,
        includeExterior,
        doorFinishes,
        doorBars,
        wardrobeType,
        supplyOnly,
      }),
    [width, height, doors, includeInterior, includeExterior, doorFinishes, doorBars, wardrobeType, supplyOnly]
  );
  const prevQuoteSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!revealUnlocked) {
      prevQuoteSignature.current = quoteSignature;
      return;
    }

    if (prevQuoteSignature.current && prevQuoteSignature.current !== quoteSignature) {
      setRevealUnlocked(false);
      setRevealedGuidePrice(null);
      setRevealState("idle");
      setRevealMessage("");
      setEmailQuoteState("idle");
      setEmailQuoteMessage("");
    }

    prevQuoteSignature.current = quoteSignature;
  }, [quoteSignature, revealUnlocked]);

    // --- Bedroom wall preview sizing ---
  const PREVIEW = {
    wallMaxW: 400, // px (max width of the wall on screen on mobile, scales up on larger screens)
    wallMinW: 250, // px (min width of the wall on screen)
    wallMaxH: 320, // px (max wall height)
    wallMinH: 220, // px (min wall height)
    widthRange: { min: 800, max: 5000 },
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
  }, [
    widthNumber,
    height,
    PREVIEW.widthRange.min,
    PREVIEW.widthRange.max,
    PREVIEW.heightRange.min,
    PREVIEW.heightRange.max,
    PREVIEW.wallMinW,
    PREVIEW.wallMaxW,
    PREVIEW.wallMinH,
    PREVIEW.wallMaxH,
  ]);

  
  return (
    <div className="wilkins-theme min-h-screen overflow-x-hidden text-neutral-50">
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
          <p className="text-xs uppercase tracking-[0.25em] text-neutral-400">Wilkins Sliding Wardrobes</p>
          <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight leading-tight">Bespoke Fitted Sliding Wardrobes in South Wales</h1>
          <p className="text-sm text-neutral-400">★★★★★ 5.0 on Google · 30 reviews · 100% recommended on Facebook</p>
          <p className="text-sm sm:text-base text-neutral-300">
            Design your ideal wardrobe and get an instant guide price based on your opening size and finish choices.
            Final pricing is confirmed after a free home design visit.
          </p>
        </div>

        <div className="mt-6 sm:mt-8 grid gap-5 sm:gap-8 lg:gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          {/* LEFT: Inputs */}
          <div className="rounded-2xl border-2 border-amber-400/50 bg-transparent p-4 sm:p-5 md:p-7">
            <h2 className="text-base sm:text-lg font-semibold">1) Select Service</h2>

            <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <label className="flex items-center gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 cursor-pointer">
                <input
                  type="radio"
                  name="wardrobeType"
                  value="basic"
                  checked={wardrobeType === "basic"}
                  onChange={() => {
                    setWardrobeType("basic");
                    trackEvent("select_service", { service: "basic" });
                  }}
                  className="h-5 w-5 accent-amber-400"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-50">Door & Running Gear</p>
                  <p className="text-xs text-neutral-400">Base option only</p>
                </div>
              </label>

              <label className="flex items-center gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 cursor-pointer">
                <input
                  type="radio"
                  name="wardrobeType"
                  value="fitted"
                  checked={wardrobeType === "fitted"}
                  onChange={() => {
                    setWardrobeType("fitted");
                    trackEvent("select_service", { service: "fitted" });
                  }}
                  className="h-5 w-5 accent-amber-400"
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-neutral-50">Fully Fitted Wardrobe</p>
                  <p className="text-xs text-neutral-400">Includes interior & exterior</p>
                </div>
              </label>
            </div>

            {wardrobeType === "basic" && (
              <div className="mt-4 grid gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Installation type</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="installType"
                      value="supply"
                      checked={supplyOnly === true}
                      onChange={() => {
                        setSupplyOnly(true);
                        trackEvent("select_install_type", { type: "supply_only" });
                      }}
                      className="h-5 w-5 accent-amber-400"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-50">Supply Only</p>
                      <p className="text-xs text-neutral-400">From £650</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3 cursor-pointer">
                    <input
                      type="radio"
                      name="installType"
                      value="fitted"
                      checked={supplyOnly === false}
                      onChange={() => {
                        setSupplyOnly(false);
                        trackEvent("select_install_type", { type: "fully_fitted" });
                      }}
                      className="h-5 w-5 accent-amber-400"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-neutral-50">Fully Fitted</p>
                      <p className="text-xs text-neutral-400">From £850</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            <h2 className="mt-8 text-base sm:text-lg font-semibold">2) Your Opening</h2>

            <div className="mt-3 sm:mt-4 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
              <label className="grid gap-1 sm:gap-2">
                <span className="text-xs sm:text-sm text-neutral-300">Opening width (mm)</span>
                <input
                  className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-base text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                  type="number"
                  min={800}
                  max={5000}
                  step={1}
                  value={width}
                  onChange={(e) => {
                    const v = e.target.value;
                    const next = v === "" ? "" : parseInt(v, 10);
                    setWidth(next);
                    if (typeof next === "number" && Number.isFinite(next)) {
                      trackEvent("update_width", { value: next });
                    }
                  }}
                  placeholder="e.g. 2000"
                />
                <span className="text-xs text-neutral-400">Supported range: 800–5000mm</span>
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
                    const next = v === "" ? "" : parseInt(v, 10);
                    setHeight(next);
                    if (typeof next === "number" && Number.isFinite(next)) {
                      trackEvent("update_height", { value: next });
                    }
                  }}
                  placeholder="e.g. 2400"
                />
                <span className="text-xs text-neutral-400">
                  {heightRequiresExterior ? "*this height requires exterior framework*" : "Supported range: 1800–3000mm"}
                </span>
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

            <h2 className="mt-8 text-base sm:text-lg font-semibold">3) Door Count</h2>

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
                onChange={(e) => {
                  const next = parseInt(e.target.value, 10);
                  setDoors(next);
                  if (Number.isFinite(next)) {
                    trackEvent("update_doors", { value: next });
                  }
                }}
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
                <p className="text-sm text-amber-200">Enter a width between 800–5000mm to enable door options.</p>
              ) : (
                <p className="text-sm text-neutral-400">Defaults to the minimum door count for your width band.</p>
              )}
            </div>

            <h2 className="mt-8 text-base sm:text-lg font-semibold">4) Configure Each Door</h2>

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

                  <div className="w-full">
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
                        const value = e.target.value as Finish;
                        next[idx] = value;
                        setDoorFinishes(next);
                        trackEvent("update_finish", { doorIndex: idx + 1, finish: value });
                      }}
                    >
                      <option value="mirror">{finishLabel("mirror")}</option>
                      <option value="glass">{finishLabel("glass")}</option>
                      <option value="wood">{finishLabel("wood")}</option>
                    </select>
                    {f === "glass" && (
                      <p className="mt-1 text-xs text-amber-200">Multiple colour options available</p>
                    )}
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
                    value={doorBars[idx]}
                    onChange={(e) => {
                      const next = [...doorBars];
                      const value = parseInt(e.target.value, 10) as BarOption;
                      next[idx] = value;
                      setDoorBars(next);
                      trackEvent("update_bars", { doorIndex: idx + 1, bars: value });
                    }}
                  >
                    <option value="0">{barLabel(0)}</option>
                    <option value="2">{barLabel(2)}</option>
                    <option value="3">{barLabel(3)}</option>
                  </select>
                </div>
              ))}
            </div>

            {wardrobeType === "basic" && !supplyOnly && (
              <>
                <h2 className="mt-8 text-base sm:text-lg font-semibold">4) Interior & Exterior</h2>

                <div className="mt-4 grid gap-3">
                  <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
                    <div>
                      <p className="text-sm font-semibold">Popular Interior Layout</p>
                      <p className="text-xs text-neutral-400">Adds a practical, popular layout inside the wardrobe which includes {widthNumber >= 4000 ? "2 x shelving units" : "1 x shelving unit"}, 1 x 18&quot; deep top shelf and an assortment of hanging rails.</p>
                      <p className="mt-1 text-xs text-neutral-200">+{money(widthNumber >= 4000 ? 550 : OPTION_PRICE.interior)}</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={includeInterior}
                      onChange={(e) => {
                        setIncludeInterior(e.target.checked);
                        trackEvent("toggle_interior", { enabled: e.target.checked ? 1 : 0 });
                      }}
                      className="h-5 w-5 accent-amber-400 mt-2 sm:mt-0"
                    />
                  </label>



              <label className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border-2 border-amber-400/50 bg-transparent p-3">
                <div>
                  <p className="text-sm font-semibold">Exterior Frame</p>
                  <p className="text-xs text-neutral-400">Adds the exterior frame for a fully built-in finish.</p>
                  <p className="mt-1 text-xs text-neutral-200">+{money(OPTION_PRICE.exterior)}</p>
                </div>
                <input
                  type="checkbox"
                  checked={includeExterior}
                  onChange={(e) => {
                    setIncludeExterior(e.target.checked);
                    trackEvent("toggle_exterior", { enabled: e.target.checked ? 1 : 0 });
                  }}
                  disabled={heightRequiresExterior}
                  className="h-5 w-5 accent-amber-400 mt-2 sm:mt-0"
                />
              </label>
                </div>
              </>
            )}
          </div>

          {/* RIGHT: Summary */}
          <div className="rounded-2xl border-2 border-amber-400/50 bg-transparent p-4 sm:p-5 md:p-7 h-fit sticky top-6 self-start max-h-[calc(100vh-3rem)] overflow-auto">
            <h2 className="text-lg font-semibold">Your Guide Price</h2>

            <div className="mt-4 rounded-2xl bg-transparent p-5">
              <p className="text-sm text-neutral-300">Estimated guide price</p>
              <div className="relative mt-1">
                <p
                  className={`text-4xl font-semibold tracking-tight transition duration-300 ${
                    revealQuote ? "" : "blur-[7px]"
                  }`}
                >
                  {revealQuote && revealedGuidePrice ? money(revealedGuidePrice.total) : showQuote ? "£x,xxx" : "—"}
                </p>
                {!revealQuote && showQuote && (
                  <span className="absolute inset-0 flex items-center text-sm text-amber-200">
                    Enter your email and postcode to reveal the guide price.
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-neutral-400">
                Final pricing is confirmed after a free home design visit to check walls, floors and layout.
              </p>

              <div className="mt-4 grid gap-2">
                <p className="text-xs uppercase tracking-[0.2em] text-neutral-400">Reveal your guide price</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                    placeholder="Email address"
                    inputMode="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={(e) =>
                      trackEvent("reveal_email_blur", {
                        provided: isValidEmail(e.target.value) ? 1 : 0,
                        length: e.target.value.trim().length,
                      })
                    }
                  />
                  <input
                    className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                    placeholder="Postcode"
                    autoComplete="postal-code"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    onBlur={(e) =>
                      trackEvent("reveal_postcode_blur", {
                        provided: e.target.value.trim().length > 0 ? 1 : 0,
                        length: e.target.value.trim().length,
                      })
                    }
                  />
                </div>
                {email.trim().length > 0 && !emailValid && (
                  <p className="text-xs text-amber-300">Enter a valid email address to reveal the guide price.</p>
                )}
                <button
                  type="button"
                  className="rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-amber-300 disabled:opacity-60"
                  disabled={!revealReady || revealState === "submitting"}
                  onClick={async () => {
                    if (!showQuote) {
                      setRevealState("error");
                      setRevealMessage("Enter a valid width and select a door count to generate a guide price.");
                      return;
                    }
                    if (!emailValid || !postcode.trim()) {
                      setRevealState("error");
                      setRevealMessage("Please enter a valid email and postcode to reveal the guide price.");
                      return;
                    }

                    if (revealState === "submitting") return;

                    setRevealState("submitting");
                    setRevealMessage("");

                    try {
                      trackEvent("click_reveal_button", {
                        wardrobeType: wardrobeType || "none",
                        supplyOnly: supplyOnly ? 1 : 0,
                        width: typeof width === "number" ? width : 0,
                        height: typeof height === "number" ? height : 0,
                        doors,
                      });

                      if (!quoteInput) {
                        throw new Error("Enter a valid width and select a door count to generate a guide price.");
                      }

                      const res = await fetch("/api/reveal-quote", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ email, postcode, quoteInput }),
                      });

                      const data = await res.json().catch(() => ({}));

                      if (!res.ok) {
                        throw new Error(data?.error || "Unable to reveal guide price. Please try again.");
                      }

                      if (!data?.guidePrice) {
                        throw new Error("Unable to reveal guide price. Please try again.");
                      }

                      setRevealState("success");
                      setRevealMessage(
                        "Your guide price is ready. You can email this quote to yourself or request a design visit whenever you're ready."
                      );
                      setRevealedGuidePrice(data.guidePrice as GuidePrice);
                      trackEvent("reveal_success", { guidePrice: data.guidePrice.total });
                      setRevealUnlocked(true);
                      setEmailQuoteState("idle");
                      setEmailQuoteMessage("");
                    } catch (err) {
                      setRevealState("error");
                      setRevealMessage(err instanceof Error ? err.message : "Unable to reveal guide price. Please try again.");
                    }
                  }}
                >
                  {revealState === "submitting" ? "Revealing..." : "Reveal"}
                </button>
                {revealQuote && (
                  <button
                    type="button"
                    className="rounded-lg border-2 border-amber-400/60 px-4 py-2 text-sm font-semibold text-amber-100 hover:border-amber-300/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={emailQuoteState === "success" || emailQuoteState === "submitting"}
                    onClick={async () => {
                      if (!showQuote) {
                        setEmailQuoteState("error");
                        setEmailQuoteMessage("Enter a valid width and select a door count to generate a guide price.");
                        return;
                      }
                      if (!emailValid || !postcode.trim()) {
                        setEmailQuoteState("error");
                        setEmailQuoteMessage("Please enter a valid email and postcode to request the quote.");
                        return;
                      }
                      if (!quoteInput || !revealedGuidePrice) {
                        setEmailQuoteState("error");
                        setEmailQuoteMessage("Reveal the guide price first before requesting the quote email.");
                        return;
                      }
                      if (emailQuoteState === "submitting" || emailQuoteState === "success") return;

                      setEmailQuoteState("submitting");
                      setEmailQuoteMessage("");

                      try {
                        const res = await fetch("/api/email-quote", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ email, postcode, quoteInput }),
                        });

                        if (!res.ok) {
                          const data = await res.json().catch(() => ({}));
                          throw new Error(data?.error || "Unable to request quote email. Please try again.");
                        }

                        setEmailQuoteState("success");
                        setEmailQuoteMessage(
                          "We'll send this guide price and breakdown to your email so you can save or share it."
                        );
                        trackEvent("email_quote_success", {
                          guidePrice: revealedGuidePrice.total,
                          width: typeof width === "number" ? width : 0,
                          height: typeof height === "number" ? height : 0,
                          doors,
                        });
                      } catch (err) {
                        setEmailQuoteState("error");
                        setEmailQuoteMessage(
                          err instanceof Error ? err.message : "Unable to request quote email. Please try again."
                        );
                      }
                    }}
                  >
                    {emailQuoteState === "success"
                      ? "Requested"
                      : emailQuoteState === "submitting"
                        ? "Sending..."
                        : "Email me this quote"}
                  </button>
                )}
                {revealMessage && (
                  <p
                    className={`text-xs ${revealState === "success" ? "text-amber-200" : "text-amber-300"}`}
                    role="status"
                    aria-live="polite"
                  >
                    {revealMessage}
                  </p>
                )}
                {emailQuoteMessage && (
                  <p
                    className={`text-xs ${emailQuoteState === "success" ? "text-amber-200" : "text-amber-300"}`}
                    role="status"
                    aria-live="polite"
                  >
                    {emailQuoteMessage}
                  </p>
                )}
                {!revealQuote && (
                  <p className="text-xs text-neutral-400">
                    We will not use these to contact you. We will only contact you if you fill out the request visit below.
                  </p>
                )}
              </div>

              {revealQuote && revealedGuidePrice && (
                <div className="mt-5 grid gap-2 text-sm">
                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Base (doors & running gear)</span>
                    <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.base)}</span>
                  </div>

                  {revealedGuidePrice.breakdown.interior > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Interior layout</span>
                      <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.interior)}</span>
                    </div>
                  )}

                  {revealedGuidePrice.breakdown.exterior > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Exterior frame</span>
                      <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.exterior)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Extra doors</span>
                    <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.extraDoors)}</span>
                  </div>

                  <div className="flex items-center justify-between text-neutral-300">
                    <span>Finish upgrades</span>
                    <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.upgrades)}</span>
                  </div>

                  {revealedGuidePrice.breakdown.bars > 0 && (
                    <div className="flex items-center justify-between text-neutral-300">
                      <span>Decorative bars</span>
                      <span className="text-neutral-50">{money(revealedGuidePrice.breakdown.bars)}</span>
                    </div>
                  )}

                  <div className="my-2 h-px bg-neutral-800" />

                  <div className="flex items-center justify-between font-semibold">
                    <span>Total</span>
                    <span>{money(revealedGuidePrice.total)}</span>
                  </div>

                  <div className="mt-4 rounded-xl border-2 border-amber-400/50 bg-transparent p-3">
                    <p className="text-xs text-neutral-300">
                      Finish breakdown:{" "}
                      <span className="font-semibold text-neutral-50">{revealedGuidePrice.finishCounts.mirror}</span> mirror,{" "}
                      <span className="font-semibold text-neutral-50">{revealedGuidePrice.finishCounts.glass}</span> coloured glass,{" "}
                      <span className="font-semibold text-neutral-50">{revealedGuidePrice.finishCounts.wood}</span> wood.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <h3 className="mt-6 text-base font-semibold">Request a Free Home Design Visit</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Leave your details and we’ll get back to arrange a no-obligation home design visit.{' '}
              <span className="text-amber-200">There&apos;s a wide range of colours and finishes to choose from</span>, and
              you can decide later in the process.
            </p>

            <form
              className="mt-4 grid gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (submitState === "submitting") return;

                const form = e.currentTarget;
                const formData = new FormData(form);
                const name = String(formData.get("name") || "").trim();
                const submittedPostcode = String(formData.get("postcode") || "").trim();
                const mobile = String(formData.get("mobile") || "").trim();
                const submittedEmail = String(formData.get("email") || "").trim();

                if (!name || !submittedPostcode || !mobile) {
                  setSubmitState("error");
                  setSubmitMessage("Please enter name, postcode, and mobile number.");
                  return;
                }

                setSubmitState("submitting");
                setSubmitMessage("");

                try {
                  trackEvent("submit_visit_request", {
                    wardrobeType: wardrobeType || "none",
                    supplyOnly: supplyOnly ? 1 : 0,
                    guidePrice: revealedGuidePrice?.total ?? 0,
                  });

                  const res = await fetch("/api/request-visit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name,
                      postcode: submittedPostcode,
                      mobile,
                      email: submittedEmail,
                      quoteInput,
                    }),
                  });

                  if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error || "Unable to submit request. Please try again.");
                  }

                  setSubmitState("success");
                  setSubmitMessage("Thanks! We will be in touch shortly to arrange your visit.");
                  trackEvent("visit_request_success", { guidePrice: revealedGuidePrice?.total ?? 0 });
                  form.reset();
                  setEmail("");
                  setPostcode("");
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
                value={postcode}
                onChange={(e) => setPostcode(e.target.value)}
              />
              <input
                className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Mobile number"
                name="mobile"
                inputMode="tel"
              />
              <input
                className="rounded-lg border-2 border-amber-400/50 bg-transparent px-2.5 py-1.5 text-sm text-neutral-50 outline-none focus:ring-2 focus:ring-amber-400/40"
                placeholder="Email (required to reveal price)"
                name="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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

            <section id="why-us" className="mt-6 rounded-2xl border-2 border-amber-400/50 bg-transparent p-4">
              <h3 className="text-base font-semibold">Why Us</h3>
              <p className="mt-2 text-sm text-neutral-300">
                We focus on made-to-measure wardrobes with clear pricing and a friendly, no-pressure design visit.
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-neutral-300">
                <li>Made-to-measure fit for your opening</li>
                <li>Helpful design visit to confirm the best layout</li>
                <li>Transparent pricing with clear upgrades</li>
              </ul>
            </section>


          </div>
        </div>
      </div>
    </div>
  );
}
