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
    // If it fails, we might want to default to true (suppressed) to be safe,
    // but in V1 we'll just log the error and allow it.
    return false;
  }

  return !!data;
}

/**
 * Adds an email to the suppression list.
 */
export async function addSuppression(email: string, reason: string): Promise<void> {
  const normalizedEmail = email.toLowerCase().trim();

  const { error } = await supabaseAdmin
    .from('email_suppressions')
    .upsert(
      { email: normalizedEmail, reason }, 
      { onConflict: 'email' }
    );

  if (error) {
    console.error('Error adding to suppression list:', error);
  }
}
