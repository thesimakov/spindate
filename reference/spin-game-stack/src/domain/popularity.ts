/**
 * popularity = kisses_received * 2 + gifts_received * 5 + likes * 1
 */
export function computePopularity(input: {
  kissesReceived: number
  giftsReceived: number
  likes: number
}): number {
  return input.kissesReceived * 2 + input.giftsReceived * 5 + input.likes * 1
}
