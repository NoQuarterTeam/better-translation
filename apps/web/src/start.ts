import { createSerializationAdapter, isRedirect } from "@tanstack/react-router"
import { createMiddleware, createStart } from "@tanstack/react-start"
import { type $ZodIssue } from "zod/v4/core"

import { env } from "./env"
import { SerializedZodIssues } from "./lib/functions/middleware"

const requestLogger = createMiddleware().server(async ({ request, next, pathname }) => {
  if (pathname.startsWith("/_serverFn")) return next()
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    const result = await next()
    const duration = Date.now() - startTime
    console.log(`[${timestamp}] ${request.method} ${pathname} - ${result.response.status} (${duration}ms)`)
    return result
  } catch (error) {
    if (isRedirect(error)) throw error
    const duration = Date.now() - startTime
    console.error(`[${timestamp}] ${request.method} ${pathname} - Error (${duration}ms):`, error)
    throw error
  }
})

const loggerMiddleware = createMiddleware({ type: "function" }).server(async ({ next, method, serverFnMeta }) => {
  const startTime = Date.now()
  const timestamp = new Date().toISOString()

  try {
    const result = await next()
    const duration = Date.now() - startTime
    console.log(`[${timestamp}] ${method} ${serverFnMeta?.name} - 200 (${duration}ms)`)
    return result
  } catch (error) {
    if (isRedirect(error)) throw error
    const duration = Date.now() - startTime
    console.error(`[${timestamp}] ${method} ${serverFnMeta?.name} - Error (${duration}ms):`, error)
    throw error
  }
})

export const serializedZodIssuesAdapter = createSerializationAdapter({
  key: "serializedZodIssues",
  test: (value: unknown) => {
    return value instanceof SerializedZodIssues
  },
  toSerializable: (value) => JSON.stringify(value.issues),
  fromSerializable: (value) => {
    const issues = JSON.parse(value) as $ZodIssue[]
    return new SerializedZodIssues(issues)
  },
})

export const startInstance = createStart(() => {
  return {
    serializationAdapters: [serializedZodIssuesAdapter],
    requestMiddleware: env.NODE_ENV === "production" ? [requestLogger] : [],
    functionMiddleware: env.NODE_ENV === "production" ? [loggerMiddleware] : [],
  }
})
