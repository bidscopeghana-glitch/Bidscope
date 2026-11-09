// Intentionally unconditional. An environment variable alone cannot enable sales.
export async function POST(){
 return Response.json({error:"Product checkout is not open. Supplier authorisation, shipping, seller disclosures and end-to-end fulfilment validation are required.",code:"commerce_checkout_disabled"},{status:503});
}
