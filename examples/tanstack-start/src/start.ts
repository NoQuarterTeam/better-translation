import { isRedirect } from "@tanstack/react-router"
import { createCsrfMiddleware, createMiddleware, createStart } from "@tanstack/react-start"

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

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
})

export const startInstance = createStart(() => {
  return {
    requestMiddleware: process.env.NODE_ENV === "production" ? [csrfMiddleware, requestLogger] : [csrfMiddleware],
    functionMiddleware: process.env.NODE_ENV === "production" ? [loggerMiddleware] : [],
  }
})
