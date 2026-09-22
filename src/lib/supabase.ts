import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mnelesyofsyrdnrynmyw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_z_8lEEr2vQKzrnt3962qow_H5doiA9J';

const REMEMBER_KEY = 'sb-remember-me';

const customStorage = {
  getItem: (key: string) => {
    return localStorage.getItem(key) ?? sessionStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    const remember = localStorage.getItem(REMEMBER_KEY) === 'true';
    if (remember) {
      localStorage.setItem(key, value);
    } else {
      sessionStorage.setItem(key, value);
    }
  },
  removeItem: (key: string) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

export function setRememberMe(value: boolean) {
  localStorage.setItem(REMEMBER_KEY, String(value));
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
  },
});
