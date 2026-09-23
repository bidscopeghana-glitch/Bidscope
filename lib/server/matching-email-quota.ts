import { supabaseRpc } from "./supabase-rest";

/** Reserves one of three matching-tender emails for this inbox on the current UTC day. */
export async function claimMatchingTenderEmail(recipient: string, deliveryKey: string) {
  const { data } = await supabaseRpc<boolean>("claim_matching_tender_email_slot", {
    p_recipient: recipient.trim().toLowerCase(),
    p_delivery_key: deliveryKey,
  });
  return data === true;
}
