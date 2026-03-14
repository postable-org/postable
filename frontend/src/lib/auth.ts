import { createClient } from './supabase';

export async function signUp(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signUp({ email, password });
}

export async function signIn(email: string, password: string) {
  const supabase = createClient();
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const supabase = createClient();
  return supabase.auth.signOut();
}

export async function resetPassword(email: string) {
  const supabase = createClient();
  return supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
  });
}
