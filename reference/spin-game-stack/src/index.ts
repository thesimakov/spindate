import { createServer } from "node:http"
import express from "express"
import cors from "cors"
import { Server } from "socket.io"
import { loadEnv } from "./config/env.js"
import { getRedis } from "./redis/client.js"
import { registerHttpRoutes } from "./http/routes.js"
import { registerSocketHandlers } from "./socket/handlers.js"

const env = loadEnv()
const redis = getRedis(env)

const app = express()
app.use(
  cors({
    origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
    credentials: true,
  }),
)
app.use(express.json({ limit: "256kb" }))
registerHttpRoutes(app, env, redis)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN,
    methods: ["GET", "POST"],
  },
})

registerSocketHandlers(io, redis)

httpServer.listen(env.PORT, () => {
  process.stdout.write(
    `[spin-game-stack] http://localhost:${env.PORT}  |  Socket.io на том же порту\n`,
  )
})
