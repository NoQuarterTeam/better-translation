import { betterTranslation, type TranslateFn } from "../src/vite.js"

const translate: TranslateFn = async (messages) => Object.fromEntries(messages.map(({ id, text }) => [id, text]))

betterTranslation({
  locales: ["en", "fr"],
  runtime: {
    type: "local",
    translate,
    translationBatchSize: 10,
  },
})

betterTranslation({
  locales: ["en", "fr"],
  runtime: {
    type: "local",
  },
})

betterTranslation({
  locales: ["en", "fr"],
  runtime: {
    type: "remote",
    projectId: "project",
  },
})

betterTranslation({
  locales: ["en", "fr"],
  // @ts-expect-error translationBatchSize requires a local translate callback.
  runtime: {
    type: "local",
    translationBatchSize: 10,
  },
})

betterTranslation({
  locales: ["en", "fr"],
  runtime: {
    type: "remote",
    projectId: "project",
    // @ts-expect-error remote mode does not accept a Consumer-app translator.
    translate,
  },
})
