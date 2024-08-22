import env from '@/env.json';
import { getHash } from '@/lib/api/utils';
import { TOTP } from 'totp-generator';

export const login = async () => {
  const { otp } = TOTP.generate(env.TOTP_CODE);

  const data = {
    apkversion: 'js:1.0.0',
    uid: env.USER_ID,
    pwd: getHash(env.PASSWORD),
    factor2: otp,
    vc: env.VENDOR_CODE,
    appkey: getHash(`${env.USER_ID}|${env.API_KEY}`),
    imei: env.IMEI,
    source: 'API',
  };

  try {
    const loginRes = await fetch('https://api.shoonya.com/NorenWClientTP/QuickAuth', {
      method: 'POST',
      body: 'jData=' + JSON.stringify(data),
    });

    if (!loginRes.ok) {
      throw new Error(await loginRes.text());
    }

    const loginResponse = await loginRes.json();
    if (loginResponse.stat === 'Not_Ok') {
      throw new Error(loginResponse.emsg);
    }

    console.log('Login successful!');

    return loginResponse.susertoken;
  } catch (error) {
    console.error('Error while logging in', error);
    console.log('Exiting...');
    process.exit(1);
  }
};
