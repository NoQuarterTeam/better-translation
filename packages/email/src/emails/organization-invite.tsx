import { Container, Heading, Hr, Text } from "@react-email/components"

import { Button, Layout } from "."

type Props = {
  firstName: string
  inviteUrl: string
  inviterName: string
  organizationName: string
}

export function OrganizationInviteEmail({
  firstName = "there",
  inviteUrl,
  inviterName,
  organizationName,
}: Props) {
  return (
    <Layout preview={`Join ${organizationName} on Better Translate`}>
      <Container className="mx-auto max-w-xl rounded-lg border border-neutral-200 px-8 py-10">
        <Heading className="m-0 text-2xl font-semibold">You're invited to an organization</Heading>
        <Text className="mt-4 text-base leading-7 text-neutral-700">
          Hi {firstName}, {inviterName} invited you to join <strong>{organizationName}</strong> on Better Translate.
        </Text>
        <Text className="text-base leading-7 text-neutral-700">
          Sign in (or create an account with this email), then accept the invitation from the link below.
        </Text>
        <Button href={inviteUrl}>Accept invitation</Button>
        <Text className="text-sm leading-6 text-neutral-500">
          If the button does not work, copy and paste this link into your browser:
        </Text>
        <Text className="text-sm break-all text-neutral-600">{inviteUrl}</Text>
        <Hr className="my-6 border-neutral-200" />
        <Text className="m-0 text-sm text-neutral-500">
          If you were not expecting this invite, you can safely ignore this email.
        </Text>
      </Container>
    </Layout>
  )
}

OrganizationInviteEmail.PreviewProps = {
  firstName: "Jane",
  inviteUrl: "http://bt.localhost:1355/accept-invitation/inv_123",
  inviterName: "Alex",
  organizationName: "Acme Localization",
} satisfies Props

export default OrganizationInviteEmail
