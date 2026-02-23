// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: true },

  runtimeConfig: {
    // Private server-side keys (never exposed to browser)
    dynamoTableName: process.env.DYNAMO_TABLE_NAME || 'chatlog-api-keys',
    dynamoAnalysisTableName: process.env.DYNAMO_ANALYSIS_TABLE_NAME || 'chatlog-analysis-requests',
    awsRegion: process.env.AWS_REGION || 'us-east-1',
    apiKeyHmacSecret: process.env.API_KEY_HMAC_SECRET || '',

    // Public keys (exposed to browser via useRuntimeConfig().public)
    public: {
      cognitoUserPoolId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_ID || '',
      cognitoUserPoolClientId: process.env.NUXT_PUBLIC_COGNITO_USER_POOL_CLIENT_ID || '',
      cognitoRegion: process.env.NUXT_PUBLIC_COGNITO_REGION || 'us-east-1',
    },
  },

  // Transpile AWS Amplify for SSR compatibility
  build: {
    transpile: ['@aws-amplify/ui-vue'],
  },

  // Disable SSR for pages that use browser-only APIs (Amplify Auth)
  ssr: true,

  nitro: {
    // Ensure server-only packages don't leak to client
    externals: {
      inline: ['@aws-sdk/client-dynamodb', '@aws-sdk/lib-dynamodb'],
    },
  },
})
