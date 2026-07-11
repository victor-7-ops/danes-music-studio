import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_URL ?? 'https://danesmusicstudio.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, priority: 1, changeFrequency: 'weekly' },
    { url: `${SITE_URL}/book`, priority: 0.9, changeFrequency: 'weekly' },
  ]
}
