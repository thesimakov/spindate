export declare const ClientEvents: {
    readonly joinRoom: "join_room";
    readonly leaveRoom: "leave_room";
    readonly spinBottle: "spin_bottle";
    readonly kissPlayer: "kiss_player";
    readonly sendGift: "send_gift";
    readonly chatMessage: "chat_message";
};
export declare const ServerEvents: {
    readonly roomState: "room_state";
    readonly spinResult: "spin_result";
    readonly kissResult: "kiss_result";
    readonly giftSent: "gift_sent";
    readonly chatMessage: "chat_message";
    readonly secretKissNotification: "secret_kiss_notification";
    readonly error: "error";
    readonly missionProgress: "mission_progress";
};
