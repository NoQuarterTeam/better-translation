import { Container, Heading, Hr, Text } from "@react-email/components"

import { Button, Layout } from "."

type Props = {
  firstName: string
  verifyUrl: string
}

export function VerifyEmail({ firstName = "there", verifyUrl }: Props) {
  return (
    <Layout preview="Verify your Better Translation email">
      <Container className="mx-auto max-w-xl rounded-lg border border-neutral-200 px-8 py-10">
        <Heading className="m-0 text-2xl font-semibold">Verify your email</Heading>
        <Text className="mt-4 text-base leading-7 text-neutral-700">
          Hi {firstName}, confirm your email address so we can secure your account and finish setting things up.
        </Text>
        <Button href={verifyUrl}>Verify email</Button>
        <Text className="text-sm leading-6 text-neutral-500">
          If the button does not work, copy and paste this link into your browser:
        </Text>
        <Text className="text-sm break-all text-neutral-600">{verifyUrl}</Text>
        <Hr className="my-6 border-neutral-200" />
        <Text className="m-0 text-sm text-neutral-500">
          If you did not create this account, you can safely ignore this email.
        </Text>
      </Container>
    </Layout>
  )
}

VerifyEmail.PreviewProps = {
  firstName: "John",
  verifyUrl: "/verify-email?token=1234567890",
} satisfies Props

export default VerifyEmail
