import { posthog } from "posthog-js";

import { siteConfig } from "../../config/site";

type EventName = "copy_install_command" | "copy_agent_prompt" | "copy_markdown" | "open_in_v0";

let ready = false;

export function initAnalytics(): void {
  if (ready || typeof window === "undefined" || !siteConfig.analytics.posthogKey) return;
  posthog.init(siteConfig.analytics.posthogKey, {
    api_host: siteConfig.analytics.posthogHost,
    persistence: "memory",
    autocapture: false,
    capture_pageview: true,
  });
  posthog.register(siteConfig.analytics.superProperties);
  ready = true;
}

export function track(
  event: EventName,
  properties: Record<string, string | number | boolean>,
): void {
  if (!ready) return;
  posthog.capture(event, properties);
}
