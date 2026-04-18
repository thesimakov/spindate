import type { Express, Request, Response } from "express"
import type { Redis } from "ioredis"
import { z } from "zod"
import { prisma } from "../db/prisma.js"
import type { Env } from "../config/env.js"
import { parseVkAuthBody, readDevVkUserId } from "../auth/vk.js"
import { createSessionToken, saveSession } from "../auth/session.js"
import { upsertUserFromVk } from "../services/user-service.js"
import { purchaseGift } from "../services/gift-service.js"
import { enqueueMatch } from "../services/matchmaking.js"
import { registerInvite, completeInviteAndReward } from "../services/invite-service.js"
import { revealSecretKiss } from "../services/secret-kiss.js"

function json(res: Response, status: number, body: unknown): void {
  res.status(status).json(body)
}

function oneParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined
  return Array.isArray(v) ? v[0] : v
}

export function registerHttpRoutes(app: Express, env: Env, redis: Redis): void {
  app.post("/api/auth/vk", async (req: Request, res: Response) => {
    try {
      let body = req.body
      if (env.DEV_VK_BYPASS) {
        const devId = readDevVkUserId(req.headers as Record<string, string | string[] | undefined>)
        if (devId && typeof body === "object" && body !== null) {
          body = { ...body, vkUserId: devId }
        }
      }
      const parsed = parseVkAuthBody(body)
      const user = await upsertUserFromVk(parsed)
      await completeInviteAndReward(parsed.vkUserId)
      const token = createSessionToken()
      await saveSession(redis, token, user.id)
      json(res, 200, {
        sessionToken: token,
        user: {
          id: user.id,
          vkId: user.vkId,
          username: user.username,
          avatar: user.avatar,
          gender: user.gender,
          age: user.age,
          coins: user.coins,
          popularity: user.popularity,
          createdAt: user.createdAt.toISOString(),
        },
      })
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "bad_request" })
    }
  })

  app.get("/api/me", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      json(res, 404, { error: "not_found" })
      return
    }
    json(res, 200, {
      id: user.id,
      vkId: user.vkId,
      username: user.username,
      avatar: user.avatar,
      gender: user.gender,
      age: user.age,
      coins: user.coins,
      popularity: user.popularity,
      createdAt: user.createdAt.toISOString(),
    })
  })

  app.get("/api/gifts", async (_req: Request, res: Response) => {
    const gifts = await prisma.giftCatalog.findMany({ orderBy: { price: "asc" } })
    json(res, 200, {
      gifts: gifts.map((g) => ({
        id: g.id,
        name: g.name,
        price: g.price,
        animation: JSON.parse(g.animation) as unknown,
      })),
    })
  })

  app.post("/api/gifts/:giftId/purchase", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    try {
      const giftId = oneParam(req.params.giftId)
      if (!giftId) {
        json(res, 400, { error: "gift_id_required" })
        return
      }
      await purchaseGift(userId, giftId)
      json(res, 200, { ok: true })
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "error" })
    }
  })

  const roomBody = z.object({
    name: z.string().min(1).max(80),
    maxPlayers: z.number().int().min(2).max(20),
  })

  app.post("/api/rooms", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    try {
      const body = roomBody.parse(req.body)
      const room = await prisma.room.create({
        data: {
          name: body.name,
          maxPlayers: body.maxPlayers,
          currentPlayers: 0,
        },
      })
      json(res, 201, { room: { id: room.id, name: room.name, maxPlayers: room.maxPlayers } })
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "bad_request" })
    }
  })

  app.get("/api/rooms/:roomId", async (req: Request, res: Response) => {
    const roomId = oneParam(req.params.roomId)
    if (!roomId) {
      json(res, 400, { error: "room_id_required" })
      return
    }
    const room = await prisma.room.findUnique({ where: { id: roomId } })
    if (!room) {
      json(res, 404, { error: "not_found" })
      return
    }
    const members = await prisma.roomMember.findMany({
      where: { roomId: room.id },
      include: { user: true },
    })
    json(res, 200, {
      room: {
        id: room.id,
        name: room.name,
        maxPlayers: room.maxPlayers,
        currentPlayers: room.currentPlayers,
        players: members.map((m) => ({
          id: m.user.id,
          username: m.user.username,
          avatar: m.user.avatar,
        })),
      },
    })
  })

  const inviteBody = z.object({ inviteeVkId: z.string().min(1) })

  app.post("/api/invites", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    try {
      const body = inviteBody.parse(req.body)
      await registerInvite(userId, body.inviteeVkId)
      json(res, 200, { ok: true })
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "bad_request" })
    }
  })

  app.post("/api/secret-kiss/:id/reveal", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    try {
      const sid = oneParam(req.params.id)
      if (!sid) {
        json(res, 400, { error: "id_required" })
        return
      }
      await revealSecretKiss(userId, sid)
      json(res, 200, { ok: true })
    } catch (e) {
      json(res, 400, { error: e instanceof Error ? e.message : "bad_request" })
    }
  })

  app.post("/api/matchmaking/enqueue", async (req: Request, res: Response) => {
    const auth = req.headers.authorization
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      json(res, 401, { error: "unauthorized" })
      return
    }
    await enqueueMatch(redis, userId)
    json(res, 200, { ok: true })
  })

  app.get("/health", (_req: Request, res: Response) => {
    json(res, 200, { ok: true, service: "spin-game-stack" })
  })
}
