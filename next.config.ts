import withPWAInit from '@ducanh2912/next-pwa'

const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
})

export default withPWA({
  turbopack: {},
  async redirects() {
    return [
      { source: '/trips/:id/members', destination: '/trips/:id/people', permanent: true },
      { source: '/trips/:id/members/:memberId', destination: '/trips/:id/people/:memberId', permanent: true },
      { source: '/trips/:id/settle', destination: '/trips/:id/money', permanent: true },
      { source: '/trips/:id/wallet', destination: '/trips/:id/money', permanent: true },
    ]
  },
})
