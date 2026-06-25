import { secureDelete, secureGet, secureSet } from './safeStore';

const REMEMBER_KEY = 'argo_aula_remember';
const USER_KEY = 'argo_aula_saved_email';
const PASS_KEY = 'argo_aula_saved_pass';

export async function loadSavedLogin(): Promise<{
  remember: boolean;
  email: string;
  password: string;
}> {
  const remember = (await secureGet(REMEMBER_KEY)) === '1';
  const email = (await secureGet(USER_KEY)) ?? '';
  const password = remember ? (await secureGet(PASS_KEY)) ?? '' : '';
  return { remember, email, password };
}

export async function persistSavedLogin(remember: boolean, email: string, password: string): Promise<void> {
  await secureSet(REMEMBER_KEY, remember ? '1' : '0');
  await secureSet(USER_KEY, email.trim());
  if (remember) await secureSet(PASS_KEY, password);
  else await secureDelete(PASS_KEY);
}
