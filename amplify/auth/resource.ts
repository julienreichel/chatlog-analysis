import { defineAuth } from '@aws-amplify/backend'

/**
 * Cognito User Pool for the Chatlog Analysis platform.
 * Users authenticate with email + password.
 * After sign-in, the Cognito ID Token is used to call the protected
 * dashboard API routes (/api/v1/auth/* and /api/v1/internal/*).
 */
export const auth = defineAuth({
  loginWith: {
    email: true,
  },
})
