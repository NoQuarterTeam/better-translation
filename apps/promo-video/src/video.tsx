import type { CSSProperties, ReactNode } from "react"
import { AbsoluteFill, Easing, Sequence, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion"

export const VIDEO_FPS = 30
export const VIDEO_WIDTH = 1920
export const VIDEO_HEIGHT = 1080
export const VIDEO_DURATION = 1260
export const TEASER_DURATION = 330

const colors = {
  background: "#0d1210",
  backgroundRaised: "#121916",
  panel: "#18201c",
  panelStrong: "#1e2924",
  border: "rgba(239, 249, 244, 0.12)",
  borderStrong: "rgba(239, 249, 244, 0.22)",
  text: "#f4f8f6",
  muted: "#9aaba3",
  green: "#5fc7a7",
  greenBright: "#8ee5ca",
  greenSoft: "rgba(95, 199, 167, 0.14)",
  amber: "#e8bd6d",
  purple: "#b8a5f8",
  blue: "#7ab8f5",
}

const fontFamily = '"Inter Variable", Inter, Arial, sans-serif'
const monoFamily = '"SFMono-Regular", Consolas, "Liberation Mono", monospace'

function clamp(value: number) {
  return Math.max(0, Math.min(1, value))
}

function progress(frame: number, from: number, to: number) {
  return clamp(interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }))
}

function Scene({ children, duration, style }: { children: ReactNode; duration: number; style?: CSSProperties }) {
  const frame = useCurrentFrame()
  const opacity = Math.min(progress(frame, 0, 18), 1 - progress(frame, duration - 18, duration))
  const translateY = interpolate(progress(frame, 0, 22), [0, 1], [24, 0], {
    easing: Easing.out((value) => Easing.cubic(value)),
  })

  return <AbsoluteFill style={{ opacity, transform: `translateY(${translateY}px)`, ...style }}>{children}</AbsoluteFill>
}

function Backdrop() {
  const frame = useCurrentFrame()
  const drift = Math.sin(frame / 95) * 34

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
        backgroundImage: `
          radial-gradient(circle at ${28 + drift / 20}% 18%, rgba(50, 151, 119, 0.17), transparent 30%),
          radial-gradient(circle at ${80 - drift / 30}% 80%, rgba(232, 189, 109, 0.07), transparent 26%),
          linear-gradient(rgba(255,255,255,0.022) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px)
        `,
        backgroundSize: "auto, auto, 54px 54px, 54px 54px",
      }}
    />
  )
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: compact ? 12 : 16 }}>
      <div
        style={{
          width: compact ? 38 : 48,
          height: compact ? 38 : 48,
          borderRadius: compact ? 11 : 14,
          display: "grid",
          placeItems: "center",
          color: "#092118",
          background: `linear-gradient(145deg, ${colors.greenBright}, ${colors.green})`,
          boxShadow: "0 10px 30px rgba(61, 172, 137, 0.22)",
        }}
      >
        <LanguagesIcon size={compact ? 21 : 27} />
      </div>
      <div style={{ color: colors.text, fontWeight: 650, fontSize: compact ? 23 : 30, letterSpacing: -0.7 }}>
        Better Translation
      </div>
    </div>
  )
}

function LanguagesIcon({ size }: { size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.1"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 8 6 6" />
      <path d="m4 14 6-6 2-3" />
      <path d="M2 5h12" />
      <path d="M7 2h1" />
      <path d="m22 22-5-10-5 10" />
      <path d="M14 18h6" />
    </svg>
  )
}

function TickIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="26"
      height="26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

function Caption({
  eyebrow,
  title,
  detail,
  align = "left",
}: {
  eyebrow: string
  title: string
  detail?: string
  align?: "left" | "center"
}) {
  return (
    <div style={{ textAlign: align, maxWidth: align === "center" ? 1160 : 780 }}>
      <div
        style={{
          color: colors.greenBright,
          textTransform: "uppercase",
          letterSpacing: 3.1,
          fontSize: 18,
          fontWeight: 720,
          marginBottom: 18,
        }}
      >
        {eyebrow}
      </div>
      <div style={{ color: colors.text, fontSize: 64, lineHeight: 1.05, letterSpacing: -2.6, fontWeight: 670 }}>{title}</div>
      {detail ? <div style={{ color: colors.muted, fontSize: 25, lineHeight: 1.45, marginTop: 22 }}>{detail}</div> : null}
    </div>
  )
}

function Window({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        overflow: "hidden",
        border: `1px solid ${colors.borderStrong}`,
        background: "rgba(19, 27, 23, 0.94)",
        borderRadius: 20,
        boxShadow: "0 30px 90px rgba(0,0,0,0.32)",
        ...style,
      }}
    >
      <div
        style={{
          height: 58,
          borderBottom: `1px solid ${colors.border}`,
          display: "flex",
          alignItems: "center",
          padding: "0 22px",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {["#f47676", "#e8bd6d", "#68c895"].map((color) => (
            <div key={color} style={{ width: 11, height: 11, borderRadius: 999, background: color, opacity: 0.78 }} />
          ))}
        </div>
        <div style={{ marginLeft: 12, color: colors.muted, fontSize: 17, fontFamily: monoFamily }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function Badge({ children, tone = "green" }: { children: ReactNode; tone?: "green" | "muted" | "amber" }) {
  const palette =
    tone === "green"
      ? { color: colors.greenBright, background: colors.greenSoft, border: "rgba(95,199,167,.3)" }
      : tone === "amber"
        ? { color: colors.amber, background: "rgba(232,189,109,.1)", border: "rgba(232,189,109,.28)" }
        : { color: colors.muted, background: "rgba(255,255,255,.045)", border: colors.border }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 13px",
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        background: palette.background,
        fontSize: 17,
        fontWeight: 630,
      }}
    >
      {children}
    </div>
  )
}

function BrowserCheckout({
  locale = "en",
  compact = false,
  updated = false,
}: {
  locale?: "en" | "nl"
  compact?: boolean
  updated?: boolean
}) {
  const isDutch = locale === "nl"
  const button = isDutch || updated ? "Nu betalen" : "Pay now"
  const title = isDutch || updated ? "Je bestelling staat klaar" : "Your order is ready"

  return (
    <div
      style={{
        padding: compact ? 28 : 42,
        minHeight: compact ? 380 : 470,
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(145deg, #f7faf8, #eef4f0)",
        color: "#18201c",
      }}
    >
      <div
        style={{
          width: compact ? 420 : 500,
          background: "white",
          borderRadius: 22,
          border: "1px solid #dfe8e3",
          boxShadow: "0 22px 70px rgba(35, 70, 55, .13)",
          padding: compact ? 27 : 34,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: compact ? 28 : 38 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                display: "grid",
                placeItems: "center",
                color: "#0e2b21",
                background: "#8ee5ca",
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 18 }}>B</span>
            </div>
            <span style={{ fontSize: 17, fontWeight: 680 }}>Beacon Goods</span>
          </div>
          <div style={{ display: "flex", padding: 4, background: "#f1f5f3", borderRadius: 10, fontSize: 13, fontWeight: 680 }}>
            <div
              style={{
                padding: "6px 9px",
                borderRadius: 7,
                color: !isDutch ? "#fff" : "#708078",
                background: !isDutch ? "#1c6a53" : "transparent",
              }}
            >
              EN
            </div>
            <div
              style={{
                padding: "6px 9px",
                borderRadius: 7,
                color: isDutch ? "#fff" : "#708078",
                background: isDutch ? "#1c6a53" : "transparent",
              }}
            >
              NL
            </div>
          </div>
        </div>
        <div style={{ color: "#78857e", fontSize: 14, textTransform: "uppercase", letterSpacing: 2, fontWeight: 720 }}>
          Checkout
        </div>
        <div style={{ fontSize: compact ? 30 : 36, lineHeight: 1.08, letterSpacing: -1.2, fontWeight: 720, marginTop: 11 }}>
          {title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "24px 0",
            borderBottom: "1px solid #e5ebe7",
            color: "#64716a",
            fontSize: 17,
          }}
        >
          <span>Everyday tote</span>
          <span style={{ color: "#18201c", fontWeight: 670 }}>€48.00</span>
        </div>
        <button
          style={{
            border: 0,
            width: "100%",
            borderRadius: 13,
            marginTop: 25,
            padding: compact ? "15px 20px" : "18px 22px",
            background: "#1c6a53",
            color: "white",
            fontFamily,
            fontSize: compact ? 18 : 20,
            fontWeight: 700,
            boxShadow: "0 10px 25px rgba(28,106,83,.2)",
          }}
        >
          {button}
        </button>
      </div>
    </div>
  )
}

function Header() {
  return (
    <div
      style={{
        position: "absolute",
        top: 42,
        left: 64,
        right: 64,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
      }}
    >
      <Brand compact />
      <Badge tone="green">Vite plugin</Badge>
    </div>
  )
}

function HookScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const cardScale = spring({ frame, fps, config: { damping: 15, stiffness: 92, mass: 0.8 } })
  const copyIn = progress(frame, 18, 58)

  return (
    <Scene duration={150}>
      <div
        style={{
          position: "absolute",
          left: 92,
          right: 92,
          top: 145,
          bottom: 72,
          display: "grid",
          gridTemplateColumns: "0.93fr 1.07fr",
          gap: 78,
          alignItems: "center",
        }}
      >
        <div style={{ opacity: copyIn, transform: `translateY(${interpolate(copyIn, [0, 1], [30, 0])}px)` }}>
          <Badge tone="amber">Vite plugin for React and Svelte</Badge>
          <div
            style={{ marginTop: 28, color: colors.text, fontSize: 78, lineHeight: 0.99, letterSpacing: -4.2, fontWeight: 680 }}
          >
            Translate your app.
            <br />
            <span style={{ color: colors.greenBright }}>Skip the keys.</span>
          </div>
          <div style={{ marginTop: 28, maxWidth: 690, color: colors.muted, fontSize: 27, lineHeight: 1.45 }}>
            Mark authored copy. Generate local Runtime bundles. Ship ordinary JSON.
          </div>
        </div>
        <div style={{ transform: `scale(${interpolate(cardScale, [0, 1], [0.9, 1])}) rotate(-1.2deg)`, opacity: cardScale }}>
          <Window title="localhost:5173 / checkout">
            <BrowserCheckout />
          </Window>
        </div>
      </div>
    </Scene>
  )
}

function CodeLine({
  number,
  children,
  highlight = false,
  indent = 0,
  opacity = 1,
}: {
  number: number
  children: ReactNode
  highlight?: boolean
  indent?: number
  opacity?: number
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "46px 1fr",
        minHeight: 45,
        alignItems: "center",
        margin: "0 -28px",
        padding: "0 28px",
        background: highlight ? colors.greenSoft : "transparent",
        borderLeft: highlight ? `3px solid ${colors.green}` : "3px solid transparent",
        opacity,
      }}
    >
      <span style={{ color: "#58665f", userSelect: "none" }}>{number}</span>
      <span style={{ whiteSpace: "pre", paddingLeft: indent * 24 }}>{children}</span>
    </div>
  )
}

const syntax = {
  keyword: { color: colors.purple },
  string: { color: colors.amber },
  component: { color: colors.greenBright },
  muted: { color: "#7a8981" },
  prop: { color: colors.blue },
}

function MarkerScene() {
  const frame = useCurrentFrame()
  const marked = frame >= 98
  const pulse = progress(frame, 92, 122) * (1 - progress(frame, 150, 185))

  return (
    <Scene duration={210}>
      <div
        style={{
          position: "absolute",
          top: 170,
          left: 95,
          right: 95,
          bottom: 76,
          display: "grid",
          gridTemplateColumns: "0.78fr 1.22fr",
          gap: 74,
          alignItems: "center",
        }}
      >
        <Caption
          eyebrow="01 — Mark"
          title="Copy stays where you wrote it."
          detail="Use a Translation marker in React or Svelte. There is no separate naming exercise."
        />
        <Window title="src/components/Checkout.tsx">
          <div
            style={{
              position: "relative",
              padding: "31px 28px 35px",
              color: "#dfe8e3",
              fontFamily: monoFamily,
              fontSize: 21,
              lineHeight: 1.65,
            }}
          >
            <CodeLine number={1}>
              <span style={syntax.keyword}>import</span> {"{ "}
              <span style={syntax.component}>T</span>
              {" } "}
              <span style={syntax.keyword}>from</span> <span style={syntax.string}>"better-translation/react"</span>
            </CodeLine>
            <CodeLine number={2}>
              <span style={syntax.muted}> </span>
            </CodeLine>
            <CodeLine number={3}>
              <span style={syntax.keyword}>export function</span> <span style={syntax.component}>CheckoutButton</span>() {"{"}
            </CodeLine>
            <CodeLine number={4} indent={1}>
              <span style={syntax.keyword}>return</span> (
            </CodeLine>
            <CodeLine number={5} indent={2}>
              <span>&lt;</span>
              <span style={syntax.component}>button</span> <span style={syntax.prop}>className</span>=
              <span style={syntax.string}>"primary"</span>&gt;
            </CodeLine>
            <CodeLine number={6} highlight={marked} indent={3}>
              <span>
                {marked ? (
                  <>
                    <span>&lt;</span>
                    <span style={syntax.component}>T</span>
                    <span>&gt;</span>
                    <span style={{ color: colors.text }}>Pay now</span>
                    <span>&lt;/</span>
                    <span style={syntax.component}>T</span>
                    <span>&gt;</span>
                  </>
                ) : (
                  <span style={{ color: colors.text }}>Pay now</span>
                )}
              </span>
            </CodeLine>
            <CodeLine number={7} indent={2}>
              <span>&lt;/</span>
              <span style={syntax.component}>button</span>
              <span>&gt;</span>
            </CodeLine>
            <CodeLine number={8} indent={1}>
              <span>)</span>
            </CodeLine>
            <CodeLine number={9}>
              <span>{"}"}</span>
            </CodeLine>
            <div
              style={{
                position: "absolute",
                left: 75,
                right: 28,
                top: 249,
                height: 52,
                borderRadius: 8,
                border: `2px solid rgba(142,229,202,${pulse})`,
                boxShadow: `0 0 35px rgba(95,199,167,${pulse * 0.22})`,
                pointerEvents: "none",
              }}
            />
          </div>
        </Window>
      </div>
    </Scene>
  )
}

function ConfigScene() {
  const frame = useCurrentFrame()
  const scan = progress(frame, 84, 152)
  const found = frame > 138

  return (
    <Scene duration={210}>
      <div style={{ position: "absolute", top: 155, left: 94, right: 94, bottom: 72 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 36 }}>
          <Caption eyebrow="02 — Discover" title="The Vite plugin does the bookkeeping." />
          <Badge tone={found ? "green" : "muted"}>
            {found ? (
              <TickIcon size={19} />
            ) : (
              <span style={{ width: 10, height: 10, borderRadius: 10, background: colors.muted }} />
            )}
            {found ? "2 Messages discovered" : "Scanning Consumer app…"}
          </Badge>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.24fr 0.76fr", gap: 28 }}>
          <Window title="vite.config.ts" style={{ height: 530 }}>
            <div style={{ padding: "26px 28px", color: "#dfe8e3", fontFamily: monoFamily, fontSize: 20, lineHeight: 1.62 }}>
              <CodeLine number={1}>
                <span style={syntax.keyword}>import</span> {"{ "}
                <span style={syntax.component}>betterTranslation</span>
                {" } "}
                <span style={syntax.keyword}>from</span> <span style={syntax.string}>"better-translation/vite"</span>
              </CodeLine>
              <CodeLine number={2}>
                <span style={syntax.muted}> </span>
              </CodeLine>
              <CodeLine number={3}>
                <span style={syntax.keyword}>export default</span> <span style={syntax.component}>defineConfig</span>({"{"}
              </CodeLine>
              <CodeLine number={4} indent={1}>
                <span style={syntax.prop}>plugins</span>: [
              </CodeLine>
              <CodeLine number={5} highlight indent={2}>
                <span style={syntax.component}>betterTranslation</span>({"{"}
              </CodeLine>
              <CodeLine number={6} highlight indent={3}>
                <span style={syntax.prop}>locales</span>: [<span style={syntax.string}>"en"</span>,{" "}
                <span style={syntax.string}>"nl"</span>],
              </CodeLine>
              <CodeLine number={7} highlight indent={3}>
                <span style={syntax.prop}>defaultLocale</span>: <span style={syntax.string}>"en"</span>,
              </CodeLine>
              <CodeLine number={8} highlight indent={3}>
                <span style={syntax.prop}>runtime</span>: {"{ "}
                <span style={syntax.prop}>type</span>: <span style={syntax.string}>"local"</span>
                {" },"}
              </CodeLine>
              <CodeLine number={9} highlight indent={2}>
                <span>{"}"}),</span>
              </CodeLine>
              <CodeLine number={10} indent={2}>
                <span style={syntax.component}>react</span>(),
              </CodeLine>
              <CodeLine number={11} indent={1}>
                <span>]</span>
              </CodeLine>
              <CodeLine number={12}>
                <span>{"}"})</span>
              </CodeLine>
            </div>
          </Window>
          <div style={{ height: 530, display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
            {[
              { label: "Checkout.tsx", text: "Your order is ready", delay: 0 },
              { label: "Checkout.tsx", text: "Pay now", delay: 28 },
            ].map((item, index) => {
              const itemProgress = progress(frame, 105 + item.delay, 140 + item.delay)
              return (
                <div
                  key={item.text}
                  style={{
                    opacity: itemProgress,
                    transform: `translateX(${interpolate(itemProgress, [0, 1], [38, 0])}px)`,
                    padding: 24,
                    borderRadius: 17,
                    border: `1px solid ${colors.border}`,
                    background: colors.panel,
                  }}
                >
                  <div style={{ color: colors.muted, fontFamily: monoFamily, fontSize: 15 }}>{item.label}</div>
                  <div style={{ color: colors.text, fontSize: 23, fontWeight: 630, marginTop: 10 }}>{item.text}</div>
                  <div style={{ color: colors.greenBright, fontFamily: monoFamily, fontSize: 15, marginTop: 13 }}>
                    m_{index === 0 ? "4k9a2f" : "7qm2c8"}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            top: 190,
            left: 0,
            width: `${scan * 100}%`,
            maxWidth: 1120,
            height: 2,
            background: `linear-gradient(90deg, transparent, ${colors.greenBright}, transparent)`,
            boxShadow: "0 0 16px rgba(142,229,202,.55)",
            opacity: 1 - progress(frame, 150, 170),
          }}
        />
      </div>
    </Scene>
  )
}

function JsonEditingScene() {
  const frame = useCurrentFrame()
  const target = "Nu betalen"
  const typedCount = Math.floor(
    interpolate(frame, [58, 128], [0, target.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  )
  const typed = target.slice(0, typedCount)
  const saved = frame >= 142
  const updated = frame >= 155
  const flash = progress(frame, 151, 163) * (1 - progress(frame, 185, 215))

  return (
    <Scene duration={240}>
      <div style={{ position: "absolute", top: 140, left: 75, right: 75, bottom: 68 }}>
        <div style={{ textAlign: "center", marginBottom: 27 }}>
          <div style={{ color: colors.greenBright, textTransform: "uppercase", letterSpacing: 3, fontSize: 18, fontWeight: 720 }}>
            03 — Edit
          </div>
          <div style={{ color: colors.text, fontSize: 51, fontWeight: 670, letterSpacing: -2, marginTop: 12 }}>
            Edit the JSON. See the app update.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.05fr 0.95fr", gap: 26 }}>
          <Window title="src/lib/bt/locales/nl.json" style={{ height: 645 }}>
            <div
              style={{
                padding: "36px 34px",
                height: 490,
                color: colors.text,
                fontFamily: monoFamily,
                fontSize: 25,
                lineHeight: 1.8,
              }}
            >
              <CodeLine number={1}>
                <span>{"{"}</span>
              </CodeLine>
              <CodeLine number={2} indent={1}>
                <span style={{ color: colors.blue }}>"m_4k9a2f"</span>:{" "}
                <span style={{ color: colors.amber }}>"Je bestelling staat klaar"</span>,
              </CodeLine>
              <CodeLine number={3} highlight={typedCount > 0} indent={1}>
                <span style={{ color: colors.blue }}>"m_7qm2c8"</span>: <span style={{ color: colors.amber }}>"{typed}</span>
                <span
                  style={{
                    display: "inline-block",
                    width: 2,
                    height: 26,
                    marginLeft: 2,
                    transform: "translateY(5px)",
                    background: colors.greenBright,
                    opacity: frame % 20 < 13 && !saved ? 1 : 0,
                  }}
                />
                <span style={{ color: colors.amber }}>",</span>
              </CodeLine>
              <CodeLine number={4} indent={1}>
                <span style={{ color: colors.blue }}>"m_q1p8vn"</span>:{" "}
                <span style={{ color: colors.amber }}>"Elke dag draagtas"</span>
              </CodeLine>
              <CodeLine number={5}>
                <span>{"}"}</span>
              </CodeLine>
            </div>
            <div
              style={{
                height: 95,
                padding: "19px 28px",
                borderTop: `1px solid ${colors.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "rgba(255,255,255,.018)",
              }}
            >
              <div>
                <div style={{ color: colors.text, fontSize: 17, fontWeight: 650 }}>
                  {saved ? "Locale value saved" : "Generated flat Runtime bundle"}
                </div>
                <div style={{ color: colors.muted, fontSize: 14, marginTop: 5 }}>
                  Ordinary lookup id → translated string JSON.
                </div>
              </div>
              <Badge tone={saved ? "green" : "muted"}>
                {saved ? <TickIcon size={18} /> : null}
                {saved ? "Saved" : "Local file"}
              </Badge>
            </div>
          </Window>
          <Window
            title="Consumer app · Vite HMR"
            style={{ height: 645, boxShadow: `0 0 ${70 * flash}px rgba(95,199,167,${flash * 0.25})` }}
          >
            <BrowserCheckout locale={updated ? "nl" : "en"} compact updated={updated} />
            <div
              style={{
                height: 95,
                padding: "19px 26px",
                borderTop: `1px solid ${colors.border}`,
                background: colors.panel,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div style={{ color: colors.text, fontSize: 17, fontWeight: 650 }}>
                  {updated ? "Runtime bundle updated" : "Waiting for Locale value"}
                </div>
                <div style={{ color: colors.muted, fontSize: 14, marginTop: 5 }}>No page reload. No subtree remount.</div>
              </div>
              <div style={{ color: updated ? colors.greenBright : colors.muted }}>
                {updated ? (
                  <TickIcon />
                ) : (
                  <span style={{ display: "block", width: 11, height: 11, borderRadius: 11, background: colors.muted }} />
                )}
              </div>
            </div>
          </Window>
        </div>
      </div>
    </Scene>
  )
}

function AiTranslatorScene() {
  const frame = useCurrentFrame()
  const translating = frame >= 78
  const finished = frame >= 145
  const flow = progress(frame, 82, 145)

  return (
    <Scene duration={210}>
      <div
        style={{
          position: "absolute",
          top: 155,
          left: 94,
          right: 94,
          bottom: 70,
          display: "grid",
          gridTemplateColumns: "0.84fr 1.16fr",
          alignItems: "center",
          gap: 65,
        }}
      >
        <div>
          <Caption
            eyebrow="04 — Optional automation"
            title="Or let your AI translator fill the gaps."
            detail="Use the built-in AI helper or provide any async translate() function. Your model, your prompt, still written to local JSON."
          />
          <div style={{ display: "flex", gap: 13, marginTop: 34 }}>
            <Badge tone="green">
              <TickIcon size={18} />
              Placeholders validated
            </Badge>
            <Badge tone="muted">Bring your own model</Badge>
          </div>
        </div>
        <div style={{ position: "relative", height: 710 }}>
          <Window title="vite.config.ts" style={{ position: "absolute", left: 0, top: 0, width: 900, zIndex: 2 }}>
            <div
              style={{
                padding: "30px 30px",
                height: 390,
                color: colors.text,
                fontFamily: monoFamily,
                fontSize: 19,
                lineHeight: 1.62,
              }}
            >
              <CodeLine number={1}>
                <span style={syntax.keyword}>import</span> {"{ "}
                <span style={syntax.component}>createAiTranslate</span>
                {" } "}
                <span style={syntax.keyword}>from</span> <span style={syntax.string}>"better-translation/ai"</span>
              </CodeLine>
              <CodeLine number={2}>
                <span> </span>
              </CodeLine>
              <CodeLine number={3}>
                <span style={syntax.component}>betterTranslation</span>({"{"}
              </CodeLine>
              <CodeLine number={4} indent={1}>
                <span style={syntax.prop}>runtime</span>: {"{"}
              </CodeLine>
              <CodeLine number={5} indent={2}>
                <span style={syntax.prop}>type</span>: <span style={syntax.string}>"local"</span>,
              </CodeLine>
              <CodeLine number={6} highlight indent={2}>
                <span style={syntax.prop}>translate</span>: <span style={syntax.component}>createAiTranslate</span>({"{"}
              </CodeLine>
              <CodeLine number={7} highlight indent={3}>
                <span style={syntax.prop}>prompt</span>: <span style={syntax.string}>"Use concise product UI copy."</span>,
              </CodeLine>
              <CodeLine number={8} highlight indent={2}>
                <span>{"}"}),</span>
              </CodeLine>
              <CodeLine number={9} indent={1}>
                <span>{"}"}</span>
              </CodeLine>
              <CodeLine number={10}>
                <span>{"}"})</span>
              </CodeLine>
            </div>
          </Window>
          <div
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 680,
              zIndex: 3,
              opacity: progress(frame, 45, 82),
              transform: `translateY(${interpolate(progress(frame, 45, 82), [0, 1], [28, 0])}px)`,
            }}
          >
            <Window title="translation batch">
              <div style={{ padding: "25px 28px", minHeight: 245, fontFamily: monoFamily, fontSize: 18, lineHeight: 1.8 }}>
                <div style={{ color: colors.muted }}>$ bt generate</div>
                <div style={{ color: translating ? colors.greenBright : colors.muted, marginTop: 12 }}>
                  {translating ? "→ Sending 3 missing Messages…" : "○ 3 missing Messages"}
                </div>
                <div style={{ color: finished ? colors.greenBright : colors.muted, opacity: progress(frame, 105, 145) }}>
                  {finished ? "✓ NL Locale values written" : "→ Validating generated values…"}
                </div>
                <div
                  style={{ marginTop: 18, height: 5, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.07)" }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${flow * 100}%`,
                      background: `linear-gradient(90deg, ${colors.green}, ${colors.greenBright})`,
                    }}
                  />
                </div>
              </div>
            </Window>
          </div>
          <div
            style={{
              position: "absolute",
              left: 670,
              top: 365,
              color: colors.greenBright,
              zIndex: 5,
              opacity: progress(frame, 48, 78),
              transform: "rotate(48deg)",
            }}
          >
            <ArrowIcon />
          </div>
        </div>
      </div>
    </Scene>
  )
}

function BuildScene() {
  const frame = useCurrentFrame()
  const rows = [
    { at: 18, text: "$ npm run build", color: colors.text },
    { at: 52, text: "✓ 2 Messages discovered", color: colors.greenBright },
    { at: 82, text: "✓ EN and NL Runtime bundles complete", color: colors.greenBright },
    { at: 112, text: "✓ production artifacts are current", color: colors.greenBright },
    { at: 140, text: "✓ built in 812ms", color: colors.text },
  ]

  return (
    <Scene duration={180}>
      <div
        style={{
          position: "absolute",
          top: 175,
          left: 100,
          right: 100,
          bottom: 80,
          display: "grid",
          gridTemplateColumns: "1.07fr 0.93fr",
          gap: 75,
          alignItems: "center",
        }}
      >
        <Window title="terminal" style={{ minHeight: 520 }}>
          <div style={{ padding: "39px 42px", fontFamily: monoFamily, fontSize: 23, lineHeight: 2.15 }}>
            {rows.map((row) => {
              const rowProgress = progress(frame, row.at, row.at + 18)
              return (
                <div
                  key={row.text}
                  style={{
                    color: row.color,
                    opacity: rowProgress,
                    transform: `translateY(${interpolate(rowProgress, [0, 1], [9, 0])}px)`,
                  }}
                >
                  {row.text}
                </div>
              )
            })}
          </div>
        </Window>
        <div>
          <Caption eyebrow="Production checks" title="Local-first, all the way to build." />
          <div style={{ display: "flex", flexDirection: "column", gap: 17, marginTop: 35 }}>
            {["No account", "No API key", "No hosted runtime required"].map((text, index) => {
              const itemProgress = progress(frame, 68 + index * 20, 92 + index * 20)
              return (
                <div
                  key={text}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    color: colors.text,
                    fontSize: 24,
                    fontWeight: 610,
                    opacity: itemProgress,
                    transform: `translateX(${interpolate(itemProgress, [0, 1], [24, 0])}px)`,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 10,
                      color: "#092118",
                      background: colors.greenBright,
                    }}
                  >
                    <TickIcon size={19} />
                  </div>
                  {text}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Scene>
  )
}

function EndScene() {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 80 } })
  const cursor = frame % 28 < 18

  return (
    <Scene duration={180}>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
        <div style={{ transform: `scale(${interpolate(enter, [0, 1], [0.92, 1])})`, opacity: enter }}>
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Brand />
          </div>
          <div
            style={{ color: colors.text, fontSize: 68, lineHeight: 1.04, fontWeight: 670, letterSpacing: -2.8, marginTop: 46 }}
          >
            Local-first translation for Vite apps.
          </div>
          <div style={{ color: colors.muted, fontSize: 26, marginTop: 20 }}>React · Svelte · ordinary JSON · optional AI</div>
          <div
            style={{
              width: 780,
              margin: "44px auto 0",
              borderRadius: 16,
              border: `1px solid ${colors.borderStrong}`,
              background: "rgba(10,15,12,.78)",
              padding: "23px 28px",
              color: colors.text,
              fontFamily: monoFamily,
              fontSize: 25,
              textAlign: "left",
              boxShadow: "0 22px 70px rgba(0,0,0,.32)",
            }}
          >
            <span style={{ color: colors.greenBright }}>$</span> npm install better-translation
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 26,
                marginLeft: 5,
                transform: "translateY(5px)",
                background: colors.greenBright,
                opacity: cursor ? 1 : 0,
              }}
            />
          </div>
          <div style={{ marginTop: 33, color: colors.greenBright, fontSize: 21, fontWeight: 640 }}>better-translation.dev</div>
        </div>
      </div>
    </Scene>
  )
}

export function BetterTranslationDemo() {
  return (
    <AbsoluteFill style={{ fontFamily, background: colors.background }}>
      <Backdrop />
      <Header />
      <Sequence from={0} durationInFrames={150}>
        <HookScene />
      </Sequence>
      <Sequence from={130} durationInFrames={210}>
        <MarkerScene />
      </Sequence>
      <Sequence from={320} durationInFrames={210}>
        <ConfigScene />
      </Sequence>
      <Sequence from={510} durationInFrames={240}>
        <JsonEditingScene />
      </Sequence>
      <Sequence from={730} durationInFrames={210}>
        <AiTranslatorScene />
      </Sequence>
      <Sequence from={920} durationInFrames={180}>
        <BuildScene />
      </Sequence>
      <Sequence from={1080} durationInFrames={180}>
        <EndScene />
      </Sequence>
    </AbsoluteFill>
  )
}

function TeaserHeader() {
  const { width } = useVideoConfig()
  const compact = width <= 1080

  return (
    <div
      style={{
        position: "absolute",
        top: compact ? 42 : 48,
        left: compact ? 46 : 64,
        right: compact ? 46 : 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        zIndex: 20,
      }}
    >
      <Brand compact />
      <Badge tone="green">Vite plugin</Badge>
    </div>
  )
}

function TeaserMarkScene() {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const portrait = height > width
  const compact = width <= 1080
  const marked = frame >= 48
  const enter = spring({ frame, fps, config: { damping: 16, stiffness: 90 } })

  return (
    <Scene duration={110}>
      <div
        style={{
          position: "absolute",
          top: portrait ? 190 : compact ? 150 : 170,
          left: compact ? 54 : 92,
          right: compact ? 54 : 92,
          bottom: compact ? 64 : 74,
          display: "grid",
          gridTemplateColumns: portrait ? "1fr" : "0.82fr 1.18fr",
          alignContent: "center",
          alignItems: "center",
          gap: portrait ? 72 : 76,
        }}
      >
        <div style={{ textAlign: portrait ? "center" : "left" }}>
          <div
            style={{
              color: colors.text,
              fontSize: portrait ? 76 : compact ? 58 : 76,
              lineHeight: 0.98,
              letterSpacing: -3.4,
              fontWeight: 690,
            }}
          >
            Translate your app.
            <br />
            <span style={{ color: colors.greenBright }}>Skip the keys.</span>
          </div>
          <div style={{ color: colors.muted, fontSize: portrait ? 28 : compact ? 22 : 27, lineHeight: 1.45, marginTop: 24 }}>
            Mark copy where you author it.
          </div>
        </div>
        <div style={{ transform: `scale(${interpolate(enter, [0, 1], [0.94, 1])})`, opacity: enter }}>
          <Window title="Checkout.tsx">
            <div
              style={{
                padding: portrait ? "38px 28px" : "34px 28px",
                color: colors.text,
                fontFamily: monoFamily,
                fontSize: portrait ? 25 : compact ? 19 : 24,
                lineHeight: 1.75,
              }}
            >
              <CodeLine number={1}>
                <span style={syntax.keyword}>export function</span> <span style={syntax.component}>Checkout</span>() {"{"}
              </CodeLine>
              <CodeLine number={2} indent={1}>
                <span style={syntax.keyword}>return</span> (
              </CodeLine>
              <CodeLine number={3} indent={2}>
                <span>&lt;</span>
                <span style={syntax.component}>button</span>
                <span>&gt;</span>
              </CodeLine>
              <CodeLine number={4} indent={3} highlight={marked}>
                {marked ? (
                  <>
                    <span>&lt;</span>
                    <span style={syntax.component}>T</span>
                    <span>&gt;</span>Pay now<span>&lt;/</span>
                    <span style={syntax.component}>T</span>
                    <span>&gt;</span>
                  </>
                ) : (
                  <>Pay now</>
                )}
              </CodeLine>
              <CodeLine number={5} indent={2}>
                <span>&lt;/</span>
                <span style={syntax.component}>button</span>
                <span>&gt;</span>
              </CodeLine>
              <CodeLine number={6} indent={1}>
                )
              </CodeLine>
              <CodeLine number={7}>{"}"}</CodeLine>
            </div>
          </Window>
        </div>
      </div>
    </Scene>
  )
}

function TeaserJsonScene() {
  const frame = useCurrentFrame()
  const { width, height } = useVideoConfig()
  const portrait = height > width
  const compact = width <= 1080
  const target = "Nu betalen"
  const typedCount = Math.floor(
    interpolate(frame, [38, 88], [0, target.length], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  )
  const updated = frame >= 98

  return (
    <Scene duration={160}>
      <div
        style={{
          position: "absolute",
          top: portrait ? 175 : compact ? 135 : 145,
          left: compact ? 44 : 76,
          right: compact ? 44 : 76,
          bottom: compact ? 44 : 64,
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: colors.text,
            fontSize: portrait ? 58 : compact ? 42 : 56,
            fontWeight: 680,
            letterSpacing: -2,
            marginBottom: portrait ? 44 : 28,
          }}
        >
          Ordinary JSON. Instant update.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: portrait ? "1fr" : "1.02fr 0.98fr", gap: portrait ? 30 : 24 }}>
          <Window title="src/lib/bt/locales/nl.json">
            <div
              style={{
                padding: portrait ? "36px 28px" : "29px 24px",
                color: colors.text,
                fontFamily: monoFamily,
                fontSize: portrait ? 23 : compact ? 16 : 20,
                lineHeight: 1.8,
              }}
            >
              <CodeLine number={1}>{"{"}</CodeLine>
              <CodeLine number={2} indent={1}>
                <span style={{ color: colors.blue }}>"m_4k9a2f"</span>:{" "}
                <span style={{ color: colors.amber }}>"Je bestelling staat klaar"</span>,
              </CodeLine>
              <CodeLine number={3} indent={1} highlight>
                <span style={{ color: colors.blue }}>"m_7qm2c8"</span>:{" "}
                <span style={{ color: colors.amber }}>"{target.slice(0, typedCount)}"</span>
              </CodeLine>
              <CodeLine number={4}>{"}"}</CodeLine>
            </div>
          </Window>
          <Window title="Consumer app · Vite HMR">
            <BrowserCheckout locale={updated ? "nl" : "en"} compact updated={updated} />
          </Window>
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: portrait ? 32 : 24 }}>
          <Badge tone="green">
            <TickIcon size={18} />
            Flat Runtime bundle
          </Badge>
          <Badge tone="muted">Optional AI translation</Badge>
        </div>
      </div>
    </Scene>
  )
}

function TeaserEndScene() {
  const frame = useCurrentFrame()
  const { width, height, fps } = useVideoConfig()
  const portrait = height > width
  const compact = width <= 1080
  const enter = spring({ frame, fps, config: { damping: 17, stiffness: 82 } })

  return (
    <Scene duration={110}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          textAlign: "center",
          padding: compact ? 52 : 80,
        }}
      >
        <div
          style={{
            opacity: enter,
            transform: `scale(${interpolate(enter, [0, 1], [0.93, 1])})`,
            width: "100%",
            maxWidth: portrait ? 920 : 1200,
          }}
        >
          <div
            style={{
              color: colors.text,
              fontSize: portrait ? 78 : compact ? 58 : 78,
              lineHeight: 1.02,
              fontWeight: 690,
              letterSpacing: -3.2,
            }}
          >
            Local-first translation for Vite.
          </div>
          <div
            style={{
              margin: `${portrait ? 52 : 40}px auto 0`,
              maxWidth: portrait ? 900 : 860,
              borderRadius: 16,
              border: `1px solid ${colors.borderStrong}`,
              background: "rgba(10,15,12,.84)",
              padding: portrait ? "26px 24px" : "22px 26px",
              color: colors.text,
              fontFamily: monoFamily,
              fontSize: portrait ? 28 : compact ? 21 : 25,
              textAlign: "left",
            }}
          >
            <span style={{ color: colors.greenBright }}>$</span> npm install better-translation
          </div>
          <div style={{ marginTop: 30, color: colors.greenBright, fontSize: portrait ? 26 : 21, fontWeight: 650 }}>
            better-translation.dev
          </div>
        </div>
      </div>
    </Scene>
  )
}

export function BetterTranslationTeaser() {
  return (
    <AbsoluteFill style={{ fontFamily, background: colors.background }}>
      <Backdrop />
      <TeaserHeader />
      <Sequence from={0} durationInFrames={110}>
        <TeaserMarkScene />
      </Sequence>
      <Sequence from={90} durationInFrames={160}>
        <TeaserJsonScene />
      </Sequence>
      <Sequence from={220} durationInFrames={110}>
        <TeaserEndScene />
      </Sequence>
    </AbsoluteFill>
  )
}
