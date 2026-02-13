export type Finish = "mirror" | "glass" | "wood";
export type BarOption = 0 | 2 | 3;
export type WardrobeType = "basic" | "fitted";

export type GuidePriceInput = {
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

export type GuidePrice = {
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

const PRICE = {
  base: 850,
  supplyOnlyBase: 650,
  extraDoor: 400,
  supplyOnlyExtraDoor: 300,
  upgradeGlass: 120,
  upgradeWood: 150,
  decorativeBar: 20,
  interior: 450,
  interiorWide: 550,
  exterior: 450,
} as const;

function getDoorBand(widthMm: number) {
  if (widthMm >= 800 && widthMm <= 2450) return { minDoors: 2, maxDoors: 3 };
  if (widthMm >= 2450 && widthMm <= 3600) return { minDoors: 3, maxDoors: 4 };
  if (widthMm >= 3600 && widthMm <= 5000) return { minDoors: 4, maxDoors: 6 };
  return { minDoors: 0, maxDoors: 0 };
}

function isFinish(value: unknown): value is Finish {
  return value === "mirror" || value === "glass" || value === "wood";
}

function isBarOption(value: unknown): value is BarOption {
  return value === 0 || value === 2 || value === 3;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function calculateGuidePrice(input: unknown): GuidePrice | null {
  if (!input || typeof input !== "object") return null;

  const raw = input as Partial<GuidePriceInput>;

  const width = raw.width;
  const height = raw.height;
  const doors = raw.doors;
  const includeInterior = raw.includeInterior;
  const includeExterior = raw.includeExterior;
  const wardrobeType = raw.wardrobeType;
  const supplyOnly = raw.supplyOnly;

  if (!isFiniteNumber(width)) return null;
  if (width < 800 || width > 5000) return null;

  if (height !== null && height !== undefined && !isFiniteNumber(height)) return null;

  if (!isFiniteNumber(doors)) return null;

  if (typeof includeInterior !== "boolean" || typeof includeExterior !== "boolean") return null;
  if (wardrobeType !== null && wardrobeType !== "basic" && wardrobeType !== "fitted") return null;
  if (supplyOnly !== null && typeof supplyOnly !== "boolean") return null;

  if (!Array.isArray(raw.doorFinishes) || !Array.isArray(raw.doorBars)) return null;
  if (raw.doorFinishes.length !== doors || raw.doorBars.length !== doors) return null;
  if (!raw.doorFinishes.every(isFinish) || !raw.doorBars.every(isBarOption)) return null;

  const band = getDoorBand(width);
  if (doors < band.minDoors || doors > band.maxDoors) return null;

  const finishCounts = { mirror: 0, glass: 0, wood: 0 };
  for (const finish of raw.doorFinishes) {
    finishCounts[finish] += 1;
  }

  const heightRequiresExterior = typeof height === "number" && height >= 2485;

  const effectiveIncludeInterior = wardrobeType === "fitted" ? true : includeInterior;
  const effectiveIncludeExterior =
    wardrobeType === "fitted" ? true : heightRequiresExterior ? true : includeExterior;
  const effectiveSupplyOnly = wardrobeType === "basic" ? supplyOnly === true : false;

  const base = effectiveSupplyOnly ? PRICE.supplyOnlyBase : PRICE.base;
  const extraDoors = Math.max(0, doors - 2) * (effectiveSupplyOnly ? PRICE.supplyOnlyExtraDoor : PRICE.extraDoor);
  const upgrades = finishCounts.glass * PRICE.upgradeGlass + finishCounts.wood * PRICE.upgradeWood;
  const bars = raw.doorBars.reduce<number>((sum, count) => sum + count * PRICE.decorativeBar, 0);
  const interior = effectiveIncludeInterior ? (width >= 4000 ? PRICE.interiorWide : PRICE.interior) : 0;
  const exterior = effectiveIncludeExterior ? PRICE.exterior : 0;

  const total = base + extraDoors + upgrades + bars + interior + exterior;

  return {
    width,
    height: typeof height === "number" ? height : null,
    doors,
    finishCounts,
    includeInterior: effectiveIncludeInterior,
    includeExterior: effectiveIncludeExterior,
    breakdown: {
      base,
      extraDoors,
      upgrades,
      bars,
      interior,
      exterior,
    },
    total,
  };
}
