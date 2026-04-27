import env from '@/env.json';
import { PI_CONNECT_API_BASE } from '@/lib/piConnectUrls';
import type { PiConnectApiError, UserDetails } from '@/types/piConnect';
import { getSessionKey } from './getSessionKey';

const USER_DETAILS_URL = `${PI_CONNECT_API_BASE}/UserDetails`;

export const getUserDetails = async () => {
  const jKey = getSessionKey();
  const res = await fetch(USER_DETAILS_URL, {
    method: 'POST',
    body:
      'jData=' +
      JSON.stringify({
        uid: env.USER_ID,
      }) +
      `&jKey=${jKey}`,
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const userDetails: UserDetails | PiConnectApiError = await res.json();
  if (userDetails.stat !== 'Ok') {
    throw new Error(userDetails.emsg);
  }

  return userDetails;
};
