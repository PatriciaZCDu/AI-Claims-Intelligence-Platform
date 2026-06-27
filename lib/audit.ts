import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append-only audit trail. Called on every state transition so each
 * AI-assisted decision is traceable for compliance and debugging.
 */
export async function logAudit(
  admin: SupabaseClient,
  claimId: string,
  actorRole: string,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await admin.from("audit_log").insert({
    claim_id: claimId,
    actor_role: actorRole,
    action,
    detail,
  });
}
