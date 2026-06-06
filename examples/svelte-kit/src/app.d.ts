declare global {
  namespace App {
    interface PageData {
      locale: string
      locales: readonly string[]
      messages: Record<string, string>
    }
  }
}

export {}
