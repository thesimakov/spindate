import type { Server, Socket } from "socket.io";
export declare class GameGateway {
    private readonly log;
    server: Server;
    joinRoom(body: {
        roomId: string;
    }, client: Socket): {
        ok: boolean;
    };
    leaveRoom(body: {
        roomId: string;
    }, client: Socket): {
        ok: boolean;
    };
    spinBottle(body: {
        roomId: string;
    }, client: Socket): {
        ok: boolean;
    };
    chat(body: {
        roomId: string;
        text: string;
    }, client: Socket): {
        ok: boolean;
    };
}
