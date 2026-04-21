import { Container, Heading, Hr, Text } from "@react-email/components"

import { Button, Layout } from "."

type Props = {
  firstName: string
  resetUrl: string
}

export function ResetPasswordEmail({ firstName = "there", resetUrl }: Props) {
  return (
    <Layout preview="Reset your Better Translation password">
      <Container className="mx-auto max-w-xl rounded-lg border border-neutral-200 px-8 py-10">
        <Heading className="m-0 text-2xl font-semibold">Reset your password</Heading>
        <Text className="mt-4 text-base leading-7 text-neutral-700">
          Hi {firstName}, we received a request to reset your password. Use the button below to choose a new one.
        </Text>
        <Button href={resetUrl}>Reset password</Button>
        <Text className="text-sm leading-6 text-neutral-500">
          If the button does not work, copy and paste this link into your browser:
        </Text>
        <Text className="text-sm break-all text-neutral-600">{resetUrl}</Text>
        <Hr className="my-6 border-neutral-200" />
        <Text className="m-0 text-sm text-neutral-500">If you did not request this, you can safely ignore this email.</Text>
      </Container>
    </Layout>
  )
}

ResetPasswordEmail.PreviewProps = {
  firstName: "John",
  resetUrl: "/reset-password?token=1234567890",
} satisfies Props

export default ResetPasswordEmail
