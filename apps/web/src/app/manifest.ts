import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Primsett',
    short_name: 'Primsett',
    description: 'Book appointments with Nigerian beauty pros.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#e84393',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
