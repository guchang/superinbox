"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { usePathname } from "@/i18n/navigation"
import { Separator } from "@/components/ui/separator"

export function Header() {
  const pathname = usePathname()
  const dashboardT = useTranslations("dashboard")
  const inboxT = useTranslations("inbox")
  const inboxDetailT = useTranslations("inboxDetail")
  const settingsT = useTranslations("settings")
  const apiKeysT = useTranslations("apiKeys")
  const logsT = useTranslations("logs")
  const llmStatisticsT = useTranslations("llmStatistics")
  const routingT = useTranslations("routingPage")
  const aiT = useTranslations("aiPage")
  const mcpT = useTranslations("mcpAdapters")

  const title = useMemo(() => {
    if (pathname === "/") return dashboardT("title")
    if (pathname.startsWith("/inbox/") && pathname !== "/inbox") {
      return inboxDetailT("title")
    }
    if (pathname.startsWith("/inbox")) return inboxT("title")
    if (pathname.startsWith("/settings/api-keys")) return apiKeysT("title")
    if (pathname.startsWith("/settings/logs")) return logsT("title")
    if (pathname.startsWith("/settings/statistics")) return llmStatisticsT("title")
    if (pathname.startsWith("/settings")) return settingsT("title")
    if (pathname.startsWith("/routing")) return routingT("title")
    if (pathname.startsWith("/category")) return aiT("title")
    if (pathname.startsWith("/mcp-adapters")) return mcpT("title")
    return ""
  }, [
    pathname,
    dashboardT,
    inboxT,
    inboxDetailT,
    settingsT,
    apiKeysT,
    logsT,
    llmStatisticsT,
    routingT,
    aiT,
    mcpT,
  ])

  if (!title) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      <Separator orientation="vertical" className="mx-2 h-4" />
      <h1 className="text-base font-medium">{title}</h1>
    </div>
  )
}
