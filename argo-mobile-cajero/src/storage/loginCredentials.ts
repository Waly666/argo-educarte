import { storeDelete, storeGet, storeSet } from './safeStore';

const K_REMEMBER = 'argo_m_remember_login';
const K_USER = 'argo_m_saved_user';
const K_PASS = 'argo_m_saved_pass';

export type SavedLogin = {
  remember: boolean;
  username: string;
  password: string;
};

export async function loadSavedLogin(): Promise<SavedLogin> {
  const remember = (await storeGet(K_REMEMBER)) === 'true';
  if (!remember) {
    return { remember: false, username: '', password: '' };
  }
  return {
    remember: true,
    username: (await storeGet(K_USER)) ?? '',
    password: (await storeGet(K_PASS)) ?? '',
  };
}

export async function persistSavedLogin(
  remember: boolean,
  username: string,
  password: string,
): Promise<void> {
  if (!remember) {
    await clearSavedLogin();
    return;
  }
  await storeSet(K_REMEMBER, 'true');
  await storeSet(K_USER, username);
  await storeSet(K_PASS, password);
}

export async function clearSavedLogin(): Promise<void> {
  await storeDelete(K_REMEMBER);
  await storeDelete(K_USER);
  await storeDelete(K_PASS);
}
