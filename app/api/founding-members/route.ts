const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const registrationUnavailable = () =>
  Response.json(
    { error: "Registration storage is being prepared. Please try again shortly." },
    { status: 503 },
  );

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

    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
    const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

    if (!supabaseUrl || !supabaseSecretKey) return registrationUnavailable();

    const headers = {
      apikey: supabaseSecretKey,
      "Content-Type": "application/json",
    };
    const member = {
      business_name: businessName,
      contact_name: contactName,
      phone,
      sector,
      consent,
      updated_at: new Date().toISOString(),
    };

    const updateExisting = () => fetch(
      `${supabaseUrl}/rest/v1/founding_members?email=eq.${encodeURIComponent(email)}`,
      {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify(member),
        cache: "no-store",
      },
    );

    let response = await updateExisting();
    if (!response.ok) {
      console.error("Supabase registration update failed", response.status, await response.text());
      return registrationUnavailable();
    }

    const updated = (await response.json()) as unknown[];
    if (updated.length === 0) {
      response = await fetch(`${supabaseUrl}/rest/v1/founding_members`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ ...member, email }),
        cache: "no-store",
      });

      if (response.status === 409) response = await updateExisting();
      if (!response.ok) {
        console.error("Supabase registration insert failed", response.status, await response.text());
        return registrationUnavailable();
      }
    }

    return Response.json({ message: "Your business is on the list. We will contact you before the Ghana launch." }, { status: 201 });
  } catch (error) {
    console.error("Founding member registration failed", error);
    return Response.json({ error: "We could not save your registration. Please try again." }, { status: 500 });
  }
}
