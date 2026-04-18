import type { Server, Socket } from "socket.io"
import type { Redis } from "ioredis"
import { prisma } from "../db/prisma.js"
import { pickRandomTarget } from "../game/spin-loop.js"
import { recalcPopularity } from "../services/user-service.js"
import { getRoomPlayerIds, getRoomSnapshot, joinRoom, leaveRoom } from "../services/room-service.js"
import { applyGiftToReceiver } from "../services/gift-service.js"
import { recordMissionProgress } from "../services/mission-service.js"
import { createSecretKiss } from "../services/secret-kiss.js"
import {
  ClientEvents,
  ServerEvents,
  type ChatBroadcastPayload,
  type KissPlayerPayload,
  type SpinResultPayload,
} from "./events.js"

type HandshakeUser = { userId: string }

function err(socket: Socket, message: string): void {
  socket.emit(ServerEvents.error, { message })
}

async function broadcastRoomState(io: Server, roomId: string): Promise<void> {
  const snap = await getRoomSnapshot(roomId)
  if (!snap) return
  io.to(roomId).emit(ServerEvents.roomState, snap)
}

export function registerSocketHandlers(io: Server, redis: Redis): void {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    const { resolveUserId } = await import("../auth/session.js")
    const userId = await resolveUserId(redis, token)
    if (!userId) {
      next(new Error("unauthorized"))
      return
    }
    ;(socket.data as HandshakeUser).userId = userId
    next()
  })

  io.on("connection", (socket: Socket) => {
    const userId = (socket.data as HandshakeUser).userId
    void socket.join(`user:${userId}`)

    socket.on(ClientEvents.joinRoom, async (payload: { roomId: string }, cb) => {
      try {
        await joinRoom(payload.roomId, userId)
        await socket.join(payload.roomId)
        await broadcastRoomState(io, payload.roomId)
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "join_failed")
        cb?.({ ok: false })
      }
    })

    socket.on(ClientEvents.leaveRoom, async (payload: { roomId: string }, cb) => {
      try {
        await leaveRoom(payload.roomId, userId)
        await socket.leave(payload.roomId)
        await broadcastRoomState(io, payload.roomId)
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "leave_failed")
        cb?.({ ok: false })
      }
    })

    socket.on(ClientEvents.spinBottle, async (payload: { roomId: string }, cb) => {
      try {
        const ids = await getRoomPlayerIds(payload.roomId)
        if (!ids.includes(userId)) {
          err(socket, "not_in_room")
          cb?.({ ok: false })
          return
        }
        const target = pickRandomTarget({ roomPlayerIds: ids, spinnerUserId: userId })
        if (!target) {
          err(socket, "no_target")
          cb?.({ ok: false })
          return
        }
        const out: SpinResultPayload = {
          roomId: payload.roomId,
          spinnerUserId: userId,
          targetUserId: target,
        }
        io.to(payload.roomId).emit(ServerEvents.spinResult, out)
        const mp = await recordMissionProgress(userId, "spin")
        if (mp?.completed && mp.rewardCoins != null) {
          io.to(socket.id).emit(ServerEvents.missionProgress, mp)
        }
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "spin_failed")
        cb?.({ ok: false })
      }
    })

    socket.on(ClientEvents.kissPlayer, async (payload: KissPlayerPayload, cb) => {
      try {
        const ids = await getRoomPlayerIds(payload.roomId)
        if (!ids.includes(userId) || !ids.includes(payload.targetUserId)) {
          err(socket, "not_in_room")
          cb?.({ ok: false })
          return
        }

        if (payload.anonymous) {
          await createSecretKiss(userId, payload.targetUserId)
          io.to(`user:${payload.targetUserId}`).emit(ServerEvents.secretKissNotification, {
            receiverId: payload.targetUserId,
            message: "Someone secretly kissed you",
          })
          cb?.({ ok: true })
          return
        }

        if (payload.action === "kiss") {
          await prisma.kissEvent.create({
            data: {
              roomId: payload.roomId,
              senderId: userId,
              receiverId: payload.targetUserId,
              action: "kiss",
            },
          })
          await prisma.user.update({
            where: { id: payload.targetUserId },
            data: { kissesReceived: { increment: 1 } },
          })
          await recalcPopularity(payload.targetUserId)
          const mp = await recordMissionProgress(userId, "kiss")
          if (mp?.completed && mp.rewardCoins != null) {
            io.to(socket.id).emit(ServerEvents.missionProgress, mp)
          }
        } else if (payload.action === "reject") {
          await prisma.kissEvent.create({
            data: {
              roomId: payload.roomId,
              senderId: userId,
              receiverId: payload.targetUserId,
              action: "reject",
            },
          })
        } else if (payload.action === "gift") {
          if (!payload.giftCatalogId) {
            err(socket, "gift_required")
            cb?.({ ok: false })
            return
          }
          const gift = await prisma.giftCatalog.findUnique({ where: { id: payload.giftCatalogId } })
          if (!gift) {
            err(socket, "gift_not_found")
            cb?.({ ok: false })
            return
          }
          await prisma.$transaction(async (tx) => {
            const sender = await tx.user.findUnique({ where: { id: userId } })
            if (!sender || sender.coins < gift.price) throw new Error("insufficient_coins")
            await tx.user.update({
              where: { id: userId },
              data: { coins: { decrement: gift.price } },
            })
            await tx.kissEvent.create({
              data: {
                roomId: payload.roomId,
                senderId: userId,
                receiverId: payload.targetUserId,
                action: "gift",
                giftId: payload.giftCatalogId,
              },
            })
          })
          await applyGiftToReceiver(payload.targetUserId)
          io.to(payload.roomId).emit(ServerEvents.giftSent, {
            roomId: payload.roomId,
            fromUserId: userId,
            toUserId: payload.targetUserId,
            giftId: payload.giftCatalogId,
          })
          const mp = await recordMissionProgress(userId, "gift")
          if (mp?.completed && mp.rewardCoins != null) {
            io.to(socket.id).emit(ServerEvents.missionProgress, mp)
          }
        }

        io.to(payload.roomId).emit(ServerEvents.kissResult, {
          roomId: payload.roomId,
          actorId: userId,
          targetUserId: payload.targetUserId,
          action: payload.action,
        })
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "kiss_failed")
        cb?.({ ok: false })
      }
    })

    socket.on(ClientEvents.sendGift, async (payload: { roomId: string; targetUserId: string; giftCatalogId: string }, cb) => {
      try {
        await prisma.$transaction(async (tx) => {
          const gift = await tx.giftCatalog.findUnique({ where: { id: payload.giftCatalogId } })
          if (!gift) throw new Error("gift_not_found")
          const sender = await tx.user.findUnique({ where: { id: userId } })
          if (!sender || sender.coins < gift.price) throw new Error("insufficient_coins")
          await tx.user.update({
            where: { id: userId },
            data: { coins: { decrement: gift.price } },
          })
          await tx.kissEvent.create({
            data: {
              roomId: payload.roomId,
              senderId: userId,
              receiverId: payload.targetUserId,
              action: "gift",
              giftId: payload.giftCatalogId,
            },
          })
        })
        await applyGiftToReceiver(payload.targetUserId)
        io.to(payload.roomId).emit(ServerEvents.giftSent, {
          roomId: payload.roomId,
          fromUserId: userId,
          toUserId: payload.targetUserId,
          giftId: payload.giftCatalogId,
        })
        const mp = await recordMissionProgress(userId, "gift")
        if (mp?.completed && mp.rewardCoins != null) {
          io.to(socket.id).emit(ServerEvents.missionProgress, mp)
        }
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "gift_failed")
        cb?.({ ok: false })
      }
    })

    socket.on(ClientEvents.chatMessage, async (payload: { roomId: string; text: string }, cb) => {
      try {
        const text = payload.text.trim().slice(0, 500)
        if (!text) {
          cb?.({ ok: false })
          return
        }
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (!user) {
          err(socket, "user_not_found")
          cb?.({ ok: false })
          return
        }
        const out: ChatBroadcastPayload = {
          roomId: payload.roomId,
          userId,
          username: user.username,
          text,
          ts: Date.now(),
        }
        io.to(payload.roomId).emit(ServerEvents.chatMessage, out)
        cb?.({ ok: true })
      } catch (e) {
        err(socket, e instanceof Error ? e.message : "chat_failed")
        cb?.({ ok: false })
      }
    })
  })
}
