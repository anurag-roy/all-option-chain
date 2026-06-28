import { env } from '@server/lib/env';
import { logger } from '@server/lib/logger';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { generate } from 'otplib';
import { CookieJar } from 'tough-cookie';

// Load user configuration from env
const accountUsername = env.KITE_USER_ID;
const accountPassword = env.KITE_PASSWORD;
const apiKey = env.KITE_API_KEY;
const apiSecret = env.KITE_API_SECRET;
const totpSecret = env.KITE_TOTP_SECRET;

// Cookie jar for session management
const cookieJar = new CookieJar();

async function fetchWithCookies(url: string, options: RequestInit = {}) {
  // Get cookies for this URL
  const cookieString = await cookieJar.getCookieString(url);

  // Add cookies to request headers
  const headers = new Headers(options.headers);
  if (cookieString) {
    headers.set('Cookie', cookieString);
  }

  // Add browser-like headers
  headers.set(
    'User-Agent',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
  headers.set(
    'Accept',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7'
  );
  headers.set('Accept-Language', 'en-US,en;q=0.9');
  headers.set('Accept-Encoding', 'gzip, deflate, br');
  headers.set('DNT', '1');
  headers.set('Connection', 'keep-alive');
  headers.set('Upgrade-Insecure-Requests', '1');

  const response = await fetch(url, { ...options, headers });

  // Store any Set-Cookie headers
  const setCookieHeaders = response.headers.getSetCookie?.() || response.headers.get('set-cookie')?.split(',') || [];

  for (const cookie of setCookieHeaders) {
    try {
      await cookieJar.setCookie(cookie, url);
    } catch (error) {
      // Ignore invalid cookies silently
    }
  }

  return response;
}

// Export for potential reuse
export async function login(): Promise<void> {
  const sessionId = Date.now().toString();

  try {
    // Step 1: Login to get request_id
    logger.info('Starting Kite login process');

    const loginUrl = 'https://kite.zerodha.com/api/login';
    const twofaUrl = 'https://kite.zerodha.com/api/twofa';

    const loginResponse = await fetchWithCookies(loginUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://kite.zerodha.com/',
        Origin: 'https://kite.zerodha.com',
      },
      body: new URLSearchParams({
        user_id: accountUsername,
        password: accountPassword,
      }),
    });

    const loginData: any = await loginResponse.json();

    if (!loginData?.data?.request_id) {
      logger.error('Login request failed - no request_id received', {
        responseStatus: loginResponse.status,
        responseData: loginData,
        hasData: !!loginData?.data,
        errorMessage: loginData?.message,
      });
      throw new Error(`Login failed: ${loginData?.message || 'Invalid response'}`);
    }

    const requestId = loginData.data.request_id;
    logger.info('Login step completed successfully');

    // Step 2: Submit 2FA
    logger.info('Starting 2FA submission');

    // Generate TOTP token
    const myToken = await generate({ secret: totpSecret });
    const accountTwoFa = myToken;

    await fetchWithCookies(twofaUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://kite.zerodha.com/',
        Origin: 'https://kite.zerodha.com',
      },
      body: new URLSearchParams({
        user_id: accountUsername,
        request_id: requestId,
        twofa_value: accountTwoFa,
        twofa_type: 'totp',
        skip_session: 'true',
      }),
    });

    logger.info('2FA request completed');

    // Wait a moment for the session to be fully established
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Step 3: Get request_token from redirect
    logger.info('Starting API session retrieval');
    let requestToken: string = '';

    try {
      const apiSessionUrl = `https://kite.trade/connect/login?api_key=${apiKey}`;

      const apiSessionResponse = await fetchWithCookies(apiSessionUrl, {
        headers: {
          Referer: 'https://kite.zerodha.com/',
        },
        redirect: 'manual', // Don't follow redirects automatically
      });

      if (apiSessionResponse.status === 302 || apiSessionResponse.status === 301) {
        // Check redirect location
        const redirectUrl = apiSessionResponse.headers.get('location');

        if (redirectUrl && redirectUrl.includes('request_token=')) {
          const url = new URL(redirectUrl);
          requestToken = url.searchParams.get('request_token') || '';
          logger.info('Request token found in direct redirect');
        } else if (redirectUrl) {
          // Follow the redirect manually
          const followResponse = await fetchWithCookies(redirectUrl, {
            redirect: 'manual',
          });

          if (followResponse.status === 302 || followResponse.status === 301) {
            const finalRedirectUrl = followResponse.headers.get('location');

            if (finalRedirectUrl?.includes('request_token=')) {
              const url = new URL(finalRedirectUrl);
              requestToken = url.searchParams.get('request_token') || '';
            } else if (finalRedirectUrl) {
              // Continue following the redirect chain - might be /connect/finish
              const nextResponse = await fetchWithCookies(finalRedirectUrl, {
                redirect: 'manual',
              });

              if (nextResponse.status === 302 || nextResponse.status === 301) {
                const nextRedirectUrl = nextResponse.headers.get('location');

                if (nextRedirectUrl?.includes('request_token=')) {
                  const url = new URL(nextRedirectUrl);
                  requestToken = url.searchParams.get('request_token') || '';
                } else {
                  throw new Error('No request_token found in redirect chain');
                }
              } else {
                // Check response body
                const body = await nextResponse.text();

                // Try to extract from response body
                const patterns = [
                  /request_token[=:][\s]*["']?([a-zA-Z0-9_\-]+)/i,
                  /window\.location\.href\s*=\s*["']([^"']*request_token=[^"']*)/i,
                ];

                for (const pattern of patterns) {
                  const match = body.match(pattern);
                  if (match) {
                    if (pattern.source.includes('window.location.href')) {
                      const redirectUrl = match[1];
                      if (redirectUrl && redirectUrl.includes('request_token=')) {
                        const url = new URL(redirectUrl);
                        requestToken = url.searchParams.get('request_token') || '';
                      }
                    } else {
                      requestToken = match[1] || '';
                    }
                    if (requestToken) {
                      break;
                    }
                  }
                }

                if (!requestToken) {
                  throw new Error('No request_token found in final response');
                }
              }
            } else {
              throw new Error('No redirect URL found');
            }
          } else {
            throw new Error(`Expected redirect but got status: ${followResponse.status}`);
          }
        } else {
          throw new Error('No redirect URL found');
        }
      } else {
        // If no redirect, check response body
        const body = await apiSessionResponse.text();

        // Try to extract from response body
        const patterns = [
          /request_token[=:][\s]*["']?([a-zA-Z0-9_\-]+)/i,
          /name=["']?request_token["']?[\s]*value=["']?([^"'\s>]+)/i,
          /"request_token"\s*:\s*"([^"]+)"/i,
          /request_token=([a-zA-Z0-9_\-]+)/i,
          /window\.location\.href\s*=\s*["']([^"']*request_token=[^"']*)/i,
        ];

        for (const pattern of patterns) {
          const match = body.match(pattern);
          if (match) {
            if (pattern.source.includes('window.location.href')) {
              // Extract from redirect URL
              const redirectUrl = match[1];
              if (redirectUrl && redirectUrl.includes('request_token=')) {
                const url = new URL(redirectUrl);
                requestToken = url.searchParams.get('request_token') || '';
              }
            } else {
              requestToken = match[1] || '';
            }
            if (requestToken) {
              break;
            }
          }
        }

        if (!requestToken) {
          throw new Error('Failed to extract request_token from API session');
        }
      }
    } catch (error: any) {
      logger.error('Failed to retrieve request token', error);
      throw new Error(`Failed to get request token: ${error.message}`);
    }

    if (!requestToken) {
      logger.error('Request token extraction failed - token is empty');
      throw new Error('Request token is empty or undefined');
    }

    logger.info('Request token extracted successfully', {
      tokenLength: requestToken.length,
    });

    // Step 4: Generate checksum
    const checksumString = apiKey + requestToken + apiSecret;
    const checksum = createHash('sha256').update(checksumString, 'utf8').digest('hex');

    // Step 5: Get access_token
    logger.info('Requesting access token');
    const tokenUrl = 'https://api.kite.trade/session/token';

    const tokenResponse = await fetchWithCookies(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: 'https://kite.trade/',
        Origin: 'https://kite.trade',
      },
      body: new URLSearchParams({
        api_key: apiKey,
        request_token: requestToken,
        checksum: checksum,
      }),
    });

    const tokenData: any = await tokenResponse.json();

    // Check if response contains the access_token
    if (!tokenData?.data?.access_token) {
      logger.error('Access token exchange failed', {
        responseStatus: tokenResponse.status,
        responseData: tokenData,
        errorMessage: tokenData?.message,
      });
      throw new Error(`Failed to obtain access token: ${tokenData?.message || 'Invalid response'}`);
    }

    const accessToken = tokenData.data.access_token;
    logger.info('Access token received successfully');

    // Write access token to file
    await writeFile('.data/accessToken.txt', accessToken);

    logger.info('Login process completed successfully');
  } catch (error: any) {
    logger.error('Login process failed', error);
    throw error;
  }
}

// Run main function if this file is executed directly
if (import.meta.main) {
  login().catch((error) => {
    console.error('Unhandled error in main:', error);
    process.exit(1);
  });
}
