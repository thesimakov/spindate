/** Единые тайминги спина для клиента и сервера, чтобы не было дрейфа по фазам. */
export const BOTTLE_SPIN_ANIMATION_MS = 6_000
export const BOTTLE_STUCK_KICK_AFTER_MS = 2_000
export const SPIN_RESOLVE_AFTER_MS = BOTTLE_SPIN_ANIMATION_MS + 500
export const SPIN_RESOLVE_GRACE_MS = 2_500
export const SPIN_HANG_FAILSAFE_MS = 20_000
export const SERVER_SPIN_STUCK_MS = 16_000
/** Если бот-ход не продвинулся ни в спин, ни в результат — сервер принудительно переводит ход дальше. */
export const SERVER_BOT_TURN_STUCK_MS = 12_000
/** Если живой ход «завис» (игрок вышел/AFK, а клиентский skip не пришёл), сервер продвигает ход сам. */
export const SERVER_HUMAN_TURN_STUCK_MS = 18_000
