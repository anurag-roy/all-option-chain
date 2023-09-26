import env from '@/env.json';
import { getHash, injectTokenIntoEnv } from '@/lib/api/utils';
import { writeFileSync } from 'fs';
import { NextApiHandler } from 'next';

const handler: NextApiHandler = async (req, res) => {
  const { totp } = req.query;

  const data = {
    apkversion: 'js:1.0.0',
    uid: env.USER_ID,
    pwd: getHash(env.PASSWORD),
    factor2: totp,
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

    writeFileSync('src/data/token.txt', loginResponse.susertoken, 'utf-8');
    injectTokenIntoEnv(loginResponse.susertoken);

    res.json({ message: 'Login successful!' });
  } catch (error) {
    res.status(500).json({ message: 'Error while logging in', error });
  }
};

export default handler;
