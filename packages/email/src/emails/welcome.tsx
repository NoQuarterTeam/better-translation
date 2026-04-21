import { Container, Heading, Hr, Section, Text } from "@react-email/components"

import { Button, Layout } from "."

type Props = {
  firstName: string
  loginUrl: string
}

export function WelcomeEmail({ firstName = "there", loginUrl }: Props) {
  return (
    <Layout preview="Welcome to Better Translation">
      <Container className="mx-auto max-w-xl rounded-lg border border-neutral-200 px-8 py-10">
        <Heading className="m-0 text-2xl font-semibold">Welcome, {firstName}</Heading>
        <Text className="mt-4 text-base leading-7 text-neutral-700">
          Your dashboard is ready. You can now configure your workspace and start managing your organization.
        </Text>
        <Section className="my-8">
          <Button href={loginUrl}>Open dashboard</Button>
        </Section>
        <Hr className="my-6 border-neutral-200" />
        <Text className="m-0 text-sm text-neutral-500">
          If you did not create this account, you can safely ignore this email.
        </Text>
      </Container>
    </Layout>
  )
}

WelcomeEmail.PreviewProps = {
  firstName: "John",
  loginUrl: "/dashboard",
} satisfies Props

export default WelcomeEmail
