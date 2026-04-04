import { Body, Button as EButton, Head, Html, Preview, Tailwind } from "@react-email/components"

export function Layout({ children, preview }: { children: React.ReactNode; preview: string }) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Tailwind config={{ theme: { extend: { colors: { brand: "#69BFA4" } } } }}>
        <Body className="mx-auto bg-white px-2 py-8 font-sans text-neutral-900">{children}</Body>
      </Tailwind>
    </Html>
  )
}

export function Button({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <EButton href={href} className="bg-brand rounded-md px-5 py-3 text-center text-lg font-semibold text-white no-underline">
      {children}
    </EButton>
  )
}
