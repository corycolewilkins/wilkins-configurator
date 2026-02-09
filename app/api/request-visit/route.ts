import { NextResponse } from "next/server";

type RequestBody = {
  name?: string;
  postcode?: string;
  contact?: string;
};

export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REQUEST_VISIT_TO || "wilkinswardrobes@gmail.com";
  const from = process.env.REQUEST_VISIT_FROM || "no-reply@wilkinswardrobes.uk";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing RESEND_API_KEY." }, { status: 500 });
  }

  let body: RequestBody = {};
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = String(body.name || "").trim();
  const postcode = String(body.postcode || "").trim();
  const contact = String(body.contact || "").trim();

  if (!name || !postcode || !contact) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  const text = [
    "New Request Visit submission",
    "",
    `Name: ${name}`,
    `Postcode: ${postcode}`,
    `Contact: ${contact}`,
  ].join("\n");

  const html = `
    <div>
      <h2>New Request Visit submission</h2>
      <p><strong>Name:</strong> ${escapeHtml(name)}</p>
      <p><strong>Postcode:</strong> ${escapeHtml(postcode)}</p>
      <p><strong>Contact:</strong> ${escapeHtml(contact)}</p>
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
      subject: "Request Visit submission",
      text,
      html,
      reply_to: contact,
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
