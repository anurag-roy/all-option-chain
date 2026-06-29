import type { ApiRoutes } from '@server/app';
import { hc } from 'hono/client';
import ky from 'ky';

const kyInstance = ky.create({
  retry: { limit: 0 },
  timeout: 30_000,
  hooks: {
    beforeError: [
      async (error) => {
        try {
          const { response } = error;
          if (response && response.body) {
            if (response.headers.get('content-type')?.includes('application/json')) {
              const json = await response.json();
              if (typeof json === 'object' && json !== null && 'message' in json) {
                error.name = 'API Error';
                error.message = json.message as string;
              }
            }
          }
        } catch {
          // Do nothing
        }
        return error;
      },
    ],
  },
});

const client = hc<ApiRoutes>('/', {
  fetch: kyInstance,
});

export const api = client.api;
