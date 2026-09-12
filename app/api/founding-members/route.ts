import { getDb } from "../../../db";
import { foundingMembers } from "../../../db/schema";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const businessName = String(body.businessName || "").trim().slice(0, 160);
    const contactName = String(body.contactName || "").trim().slice(0, 120);
    const email = String(body.email || "").trim().toLowerCase().slice(0, 180);
    const phone = String(body.phone || "").trim().slice(0, 60);
    const sector = String(body.sector || "").trim().slice(0, 120);
    const consent = body.consent === "yes" || body.consent === true;

    if (!businessName || !contactName || !sector || !emailPattern.test(email)) {
      return Response.json({ error: "Please provide a business name, contact name, valid email and sector." }, { status: 400 });
    }
    if (!consent) return Response.json({ error: "Consent is required to join the programme." }, { status: 400 });

    const db = getDb();
    await db.insert(foundingMembers).values({ businessName, contactName, email, phone, sector, consent }).onConflictDoUpdate({
      target: foundingMembers.email,
      set: { businessName, contactName, phone, sector, consent },
    });
    return Response.json({ message: "Your business is on the list. We will contact you before the Ghana launch." }, { status: 201 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unexpected error";
    if (detail.includes("no such table") || detail.includes("D1 binding")) {
      return Response.json({ error: "Registration storage is being prepared. Please try again shortly." }, { status: 503 });
    }
    return Response.json({ error: "We could not save your registration. Please try again." }, { status: 500 });
  }
}
