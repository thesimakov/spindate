import { isVkRuntimeEnvironment, showVkNativeAd } from "@/lib/vk-bridge"
import type { RuntimeHost } from "@/lib/social-runtime"

/** Реклама с вознаграждением: только VK; ОК — заглушка до интеграции OK Ads API. */
export async function showEmbeddedRewardVideoAd(runtimeHost: RuntimeHost): Promise<boolean> {
  if (runtimeHost === "vk") {
    if (!(await isVkRuntimeEnvironment())) return false
    try {
      await showVkNativeAd("reward")
      return true
    } catch {
      return false
    }
  }
  return false
}
