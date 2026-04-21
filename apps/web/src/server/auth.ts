import { waitUntil } from "@vercel/functions"
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { organization } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"

import { OrganizationInviteEmail, ResetPasswordEmail, VerifyEmail } from "@better-translation/email"

import { getBaseUrl } from "@/lib/config"
import { db } from "@/server/db"
import {
  accountsTable,
  invitationsTable,
  membersTable,
  organizationsTable,
  sessionsTable,
  usersTable,
  verificationsTable,
} from "@/server/db/schema"
import { sendAppEmail } from "@/server/email"

function getFirstName(name: string | null | undefined) {
  if (!name) return "there"
  const [firstName] = name.trim().split(/\s+/)
  return firstName || "there"
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      users: usersTable,
      sessions: sessionsTable,
      accounts: accountsTable,
      verifications: verificationsTable,
      organizations: organizationsTable,
      members: membersTable,
      invitations: invitationsTable,
    },
  }),

  user: {
    additionalFields: {
      isAdmin: { type: "boolean", input: false, required: false },
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      waitUntil(
        sendAppEmail({
          to: user.email,
          subject: "Reset your Better Translation password",
          react: ResetPasswordEmail({ firstName: getFirstName(user.name), resetUrl: url }),
        }),
      )
    },
  },
  emailVerification: {
    autoSignInAfterVerification: true,
    sendOnSignUp: true,
    sendOnSignIn: true,
    sendVerificationEmail: async ({ user, url }) => {
      waitUntil(
        sendAppEmail({
          to: user.email,
          subject: "Verify your Better Translation email",
          react: VerifyEmail({ firstName: getFirstName(user.name), verifyUrl: url }),
        }),
      )
    },
  },
  advanced: {
    backgroundTasks: { handler: waitUntil },
    database: { generateId: false },
  },
  plugins: [
    tanstackStartCookies(),
    // haveIBeenPwned({
    //   customPasswordCompromisedMessage:
    //     "The password you have entered is too common or has been compromised. Please choose a different password.",
    // }),
    organization({
      sendInvitationEmail: async (data) => {
        const inviteUrl = `${getBaseUrl()}/accept-invitation/${data.id}`
        const inviterName = data.inviter.user.name?.trim() || data.inviter.user.email
        waitUntil(
          sendAppEmail({
            to: data.email,
            subject: `${inviterName} invited you to ${data.organization.name} on Better Translation`,
            react: OrganizationInviteEmail({
              firstName: "there",
              organizationName: data.organization.name,
              inviteUrl,
              inviterName,
            }),
          }),
        )
      },
    }),
  ],
  session: { cookieCache: { enabled: true } },
  // TODO: Add the production origin
  trustedOrigins: ["http://bt.local:1355"],
})
