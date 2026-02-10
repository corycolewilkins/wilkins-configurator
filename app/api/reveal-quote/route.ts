import { NextResponse } from "next/server";

type RevealBody = {
  email?: string;
  postcode?: string;
  guidePrice?: {
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
  } | null;
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

  const priceLines = body.guidePrice
    ? [
        "",
        "Guide price details",
        `Width: ${body.guidePrice.width ?? "-"}mm`,
        `Height: ${body.guidePrice.height ?? "-"}mm`,
        `Doors: ${body.guidePrice.doors}`,
        `Finishes: ${body.guidePrice.finishCounts.mirror} mirror, ${body.guidePrice.finishCounts.glass} glass, ${body.guidePrice.finishCounts.wood} wood`,
        `Interior: ${body.guidePrice.includeInterior ? "Yes" : "No"}`,
        `Exterior: ${body.guidePrice.includeExterior ? "Yes" : "No"}`,
        `Base: ${formatCurrency(body.guidePrice.breakdown.base)}`,
        `Extra doors: ${formatCurrency(body.guidePrice.breakdown.extraDoors)}`,
        `Finish upgrades: ${formatCurrency(body.guidePrice.breakdown.upgrades)}`,
        `Decorative bars: ${formatCurrency(body.guidePrice.breakdown.bars)}`,
        `Interior: ${formatCurrency(body.guidePrice.breakdown.interior)}`,
        `Exterior: ${formatCurrency(body.guidePrice.breakdown.exterior)}`,
        `Total: ${formatCurrency(body.guidePrice.total)}`,
      ]
    : ["", "Guide price details", "Not available (no valid quote yet)."];

  const text = [
    "Guide price revealed",
    "",
    `Email: ${email}`,
    `Postcode: ${postcode}`,
    ...priceLines,
  ].join("\n");

  const guideHtml = body.guidePrice
    ? `
      <h3>Guide price details</h3>
      <ul>
        <li>Width: ${body.guidePrice.width ?? "-"}mm</li>
        <li>Height: ${body.guidePrice.height ?? "-"}mm</li>
        <li>Doors: ${body.guidePrice.doors}</li>
        <li>Finishes: ${body.guidePrice.finishCounts.mirror} mirror, ${body.guidePrice.finishCounts.glass} glass, ${body.guidePrice.finishCounts.wood} wood</li>
        <li>Interior: ${body.guidePrice.includeInterior ? "Yes" : "No"}</li>
        <li>Exterior: ${body.guidePrice.includeExterior ? "Yes" : "No"}</li>
      </ul>
      <ul>
        <li>Base: ${formatCurrency(body.guidePrice.breakdown.base)}</li>
        <li>Extra doors: ${formatCurrency(body.guidePrice.breakdown.extraDoors)}</li>
        <li>Finish upgrades: ${formatCurrency(body.guidePrice.breakdown.upgrades)}</li>
        <li>Decorative bars: ${formatCurrency(body.guidePrice.breakdown.bars)}</li>
        <li>Interior: ${formatCurrency(body.guidePrice.breakdown.interior)}</li>
        <li>Exterior: ${formatCurrency(body.guidePrice.breakdown.exterior)}</li>
        <li><strong>Total: ${formatCurrency(body.guidePrice.total)}</strong></li>
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

  return NextResponse.json({ ok: true });
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
