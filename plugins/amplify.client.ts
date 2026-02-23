/**
 * Nuxt plugin: configure AWS Amplify with Cognito settings on app start.
 * Runs client-side only (the .client.ts suffix ensures that).
 */
import { Amplify } from 'aws-amplify'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const { cognitoUserPoolId, cognitoUserPoolClientId, cognitoRegion } = config.public

  if (!cognitoUserPoolId || !cognitoUserPoolClientId) {
    console.warn('[amplify] Cognito credentials not configured – auth will not work')
    return
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: cognitoUserPoolId,
        userPoolClientId: cognitoUserPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  })
})
