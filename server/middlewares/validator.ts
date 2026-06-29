import { zValidator as zv } from '@hono/zod-validator';
import type { ValidationTargets } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { type ZodType } from 'zod';

export const routeValidator = <T extends ZodType, Target extends keyof ValidationTargets>(target: Target, schema: T) =>
  zv(target, schema, (result) => {
    if (!result.success) {
      const message = result.error.issues.map((issue) => issue.message).join(', ');
      throw new HTTPException(400, { message });
    }
  });
