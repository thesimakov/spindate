/**
 * Next.js + WebSocket на одном порту (для локальной разработки и self-hosted).
 * Запуск: `npm run dev:ws` или `npx tsx server/custom-server.ts`
 *
 * Клиент: `new WebSocket(`${location.origin.replace(/^http/, "ws")}/ws/rooms`)`
 */
import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { WebSocketServer } from "ws"
import { getWsRoomServer } from "@/lib/rooms/ws-room-server"

const dev = process.env.NODE_ENV !== "production"
const port = Number.parseInt(process.env.PORT ?? "3000", 10)

const app = next({ dev })
const handle = app.getRequestHandler()

void app.prepare().then(() => {
  const roomWs = getWsRoomServer()
  const wss = new WebSocketServer({ noServer: true })

  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url ?? "", true)
    void handle(req, res, parsedUrl)
  })

  server.on("upgrade", (request, socket, head) => {
    const pathname = parse(request.url ?? "", true).pathname ?? ""
    if (pathname === "/ws/rooms") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        roomWs.onConnection(ws)
      })
    } else {
      socket.destroy()
    }
  })

  server.listen(port, () => {
    process.stdout.write(`[rooms-ws] http://localhost:${port}  WebSocket: /ws/rooms\n`)
  })
})
