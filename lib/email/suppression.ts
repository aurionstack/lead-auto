// ============================================================
// lib/email/suppression.ts
// ============================================================
import { supabaseAdmin } from '../supabase';

/**
 * Checks if an email is on the suppression list.
 * @param email The email address to check.
 * @returns true if suppressed, false otherwise.
 */
export async function isSuppressed(email: string): Promise<boolean> {
  const normalizedEmail = email.toLowerCase().trim();

  const { data, error } = await supabaseAdmin
    .from('email_suppressions')
    .select('id')
    .eq('email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Error checking suppression list:', error);
    // Fail closed: a suppression-system outage must never cause an email send.
    return true;
  }

  return !!data;
}

/**
 * Adds an email to the suppression list.
 */
export async function addSuppression(email: string, reason: string, organizationId?: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await supabaseAdmin
    .from('email_suppressions')
    .upsert(
      { email: normalizedEmail, reason, ...(organizationId ? { organization_id: organizationId } : {}) },
      { onConflict: 'email' }
    );

  if (error) {
    console.error('Error adding to suppression list:', error);
    throw error;
  }
}
