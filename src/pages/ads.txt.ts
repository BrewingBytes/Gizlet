import type { APIRoute } from 'astro';

import { getAdsTxt } from '../data/advertising';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(getAdsTxt(), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
