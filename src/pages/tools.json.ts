import type { APIRoute } from 'astro';

import { getAgentCatalog } from '../data/agent-catalog';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(JSON.stringify(getAgentCatalog(), null, 2) + '\n', {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
