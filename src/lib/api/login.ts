import env from '@/env.json';
import { getHash } from '@/lib/api/utils';
import { TOTP } from 'totp-generator';

const BASE = 'https://trade.shoonya.com';
const PORTAL_SALT = 'S3cur3!d';
const APK_VERSION = 'W2_20250926';
const USER_AGENT = 'Mozilla/5.0';
const DEFAULT_VC = 'NOREN_API';

type QuickAuthResponse = {
  stat?: string;
  emsg?: string;
  susertoken?: string;
};

export const login = async () => {
  const appKey = env.VENDOR_CODE || `${env.USER_ID}_U`;
  const loginPage = `${BASE}/OAuthlogin/investor-entry-level/login?api_key=${encodeURIComponent(appKey)}&route_to=abc`;
  const { otp } = TOTP.generate(env.TOTP_CODE);

  const data = {
    apkversion: APK_VERSION,
    uid: env.USER_ID,
    pwd: getHash(env.PASSWORD),
    factor2: otp,
    vc: DEFAULT_VC,
    appkey: getHash(`${env.USER_ID}|${PORTAL_SALT}`),
    imei: env.IMEI || `api_login_${env.USER_ID}`,
    source: 'API',
    addldivinf: USER_AGENT,
    app_key: appKey,
  };

  try {
    const loginPageResponse = await fetch(loginPage, {
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!loginPageResponse.ok) {
      throw new Error(`Login page request failed: ${loginPageResponse.status} ${loginPageResponse.statusText}`);
    }

    const loginRes = await fetch(`${BASE}/NorenWClientAPI/QuickAuth`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: BASE,
        Referer: loginPage,
        'User-Agent': USER_AGENT,
      },
      body: `jData=${JSON.stringify(data)}&jKey=`,
    });

    if (!loginRes.ok) {
      throw new Error(await loginRes.text());
    }

    const loginResponse = (await loginRes.json()) as QuickAuthResponse;
    if (loginResponse.stat !== 'Ok' || !loginResponse.susertoken) {
      throw new Error(loginResponse.emsg || 'QuickAuth failed');
    }

    console.log('Login successful!');

    return loginResponse.susertoken;
  } catch (error) {
    console.error('Error while logging in', error);
    console.log('Exiting...');
    process.exit(1);
  }
};
