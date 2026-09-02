import type { APIRoute } from 'astro';

import { getLlmsTxt } from '../data/agent-catalog';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(getLlmsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
