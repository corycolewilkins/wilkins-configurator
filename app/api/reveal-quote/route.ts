import { NextResponse } from "next/server";
import { calculateGuidePrice, type GuidePriceInput } from "@/lib/guide-price";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type RevealBody = {
  email?: string;
  postcode?: string;
  quoteInput?: GuidePriceInput | null;
};

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REQUEST_VISIT_TO || "wilkinswardrobes@gmail.com";
  const from = process.env.REQUEST_VISIT_FROM || "no-reply@wilkinswardrobes.uk";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY." }, { status: 500 });
  }

  let body: RevealBody = {};
  try {
    body = (await req.json()) as RevealBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  const postcode = String(body.postcode || "").trim();

  if (!email || !postcode) {
    return NextResponse.json({ error: "Email and postcode are required." }, { status: 400 });
  }

  const limit = 5;
  const windowMs = toPositiveInt(process.env.REVEAL_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1000);
  const identifier = `${getClientIp(req)}:${email.toLowerCase()}`;
  const rate = checkRateLimit(`reveal:${identifier}`, { limit, windowMs });

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many reveal attempts. Please wait a few minutes and try again." },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const guidePrice = calculateGuidePrice(body.quoteInput);
  if (!guidePrice) {
    return NextResponse.json({ error: "Unable to generate guide price from current selections." }, { status: 400 });
  }

  const priceLines = guidePrice
    ? [
        "",
        "Guide price details",
        `Width: ${guidePrice.width ?? "-"}mm`,
        `Height: ${guidePrice.height ?? "-"}mm`,
        `Doors: ${guidePrice.doors}`,
        `Finishes: ${guidePrice.finishCounts.mirror} mirror, ${guidePrice.finishCounts.glass} glass, ${guidePrice.finishCounts.wood} wood`,
        `Interior: ${guidePrice.includeInterior ? "Yes" : "No"}`,
        `Exterior: ${guidePrice.includeExterior ? "Yes" : "No"}`,
        `Base: ${formatCurrency(guidePrice.breakdown.base)}`,
        `Extra doors: ${formatCurrency(guidePrice.breakdown.extraDoors)}`,
        `Finish upgrades: ${formatCurrency(guidePrice.breakdown.upgrades)}`,
        `Decorative bars: ${formatCurrency(guidePrice.breakdown.bars)}`,
        `Interior: ${formatCurrency(guidePrice.breakdown.interior)}`,
        `Exterior: ${formatCurrency(guidePrice.breakdown.exterior)}`,
        `Total: ${formatCurrency(guidePrice.total)}`,
      ]
    : ["", "Guide price details", "Not available (no valid quote yet)."];

  const text = [
    "Guide price revealed",
    "",
    `Email: ${email}`,
    `Postcode: ${postcode}`,
    ...priceLines,
  ].join("\n");

  const guideHtml = guidePrice
    ? `
      <h3>Guide price details</h3>
      <ul>
        <li>Width: ${guidePrice.width ?? "-"}mm</li>
        <li>Height: ${guidePrice.height ?? "-"}mm</li>
        <li>Doors: ${guidePrice.doors}</li>
        <li>Finishes: ${guidePrice.finishCounts.mirror} mirror, ${guidePrice.finishCounts.glass} glass, ${guidePrice.finishCounts.wood} wood</li>
        <li>Interior: ${guidePrice.includeInterior ? "Yes" : "No"}</li>
        <li>Exterior: ${guidePrice.includeExterior ? "Yes" : "No"}</li>
      </ul>
      <ul>
        <li>Base: ${formatCurrency(guidePrice.breakdown.base)}</li>
        <li>Extra doors: ${formatCurrency(guidePrice.breakdown.extraDoors)}</li>
        <li>Finish upgrades: ${formatCurrency(guidePrice.breakdown.upgrades)}</li>
        <li>Decorative bars: ${formatCurrency(guidePrice.breakdown.bars)}</li>
        <li>Interior: ${formatCurrency(guidePrice.breakdown.interior)}</li>
        <li>Exterior: ${formatCurrency(guidePrice.breakdown.exterior)}</li>
        <li><strong>Total: ${formatCurrency(guidePrice.total)}</strong></li>
      </ul>
    `
    : "<p><strong>Guide price details:</strong> Not available (no valid quote yet).</p>";

  const html = `
    <div>
      <h2>Guide price revealed</h2>
      <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      <p><strong>Postcode:</strong> ${escapeHtml(postcode)}</p>
      ${guideHtml}
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: "Guide price revealed",
      text,
      html,
      reply_to: email || undefined,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(
      { error: data?.message || "Email send failed." },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { ok: true, guidePrice },
    {
      headers: {
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(rate.remaining),
      },
    }
  );
}

function toPositiveInt(raw: string | undefined, fallback: number) {
  const value = Number.parseInt(raw || "", 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}
