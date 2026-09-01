import type { APIRoute } from 'astro';

import { getSitemapXml } from '../data/sitemap';

export const prerender = true;

export const GET: APIRoute = () =>
  new Response(getSitemapXml(), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
