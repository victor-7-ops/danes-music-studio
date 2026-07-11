import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_URL ?? 'https://danesmusicstudio.vercel.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api', '/book/confirm', '/book/pay', '/booking'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
