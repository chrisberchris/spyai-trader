import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnon = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnon) {
  console.warn('Supabase env vars missing — auth will not work.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnon || '');

// Auth helpers
export const auth = {
  signUp:        (email, password) => supabase.auth.signUp({ email, password }),
  signIn:        (email, password) => supabase.auth.signInWithPassword({ email, password }),
  signOut:       () => supabase.auth.signOut(),
  resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  }),
  getSession:    () => supabase.auth.getSession(),
  onAuthChange:  (cb) => supabase.auth.onAuthStateChange(cb),
};
