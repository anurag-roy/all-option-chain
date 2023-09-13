import env from '@/env.json';

export const getUserDetails = async () => {
  const res = await fetch(
    'https://api.shoonya.com/NorenWClientTP/UserDetails',
    {
      method: 'POST',
      body:
        'jData=' +
        JSON.stringify({
          uid: env.USER_ID,
        }) +
        `&jKey=${process.env.token}`,
    }
  );
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const userDetails = await res.json();
  if (userDetails.stat !== 'Ok') {
    throw new Error(userDetails.emsg);
  }

  return userDetails;
};
