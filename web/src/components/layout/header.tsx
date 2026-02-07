"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"

export function Header() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const isMobile = useIsMobile()
  const dashboardT = useTranslations("dashboard")
  const inboxT = useTranslations("inbox")
  const inboxDetailT = useTranslations("inboxDetail")
  const settingsT = useTranslations("settings")
  const mobileSettingsT = useTranslations("settings.mobileMenu")
  const apiKeysT = useTranslations("apiKeys")
  const logsT = useTranslations("logs")
  const llmStatisticsT = useTranslations("llmStatistics")
  const routingT = useTranslations("routingPage")
  const aiT = useTranslations("aiPage")
  const mcpT = useTranslations("mcpAdapters")

  const showBackToMobileSettings =
    isMobile && searchParams.get("from") === "mobile-settings" && pathname !== "/settings/mobile"

  const title = useMemo(() => {
    if (pathname === "/dashboard" || pathname === "/") return dashboardT("title")
    if (pathname.startsWith("/inbox/") && pathname !== "/inbox") {
      return inboxDetailT("title")
    }
    if (pathname.startsWith("/inbox")) return inboxT("title")
    if (pathname.startsWith("/settings/api-keys")) return apiKeysT("title")
    if (pathname.startsWith("/settings/logs")) return logsT("title")
    if (pathname.startsWith("/settings/statistics")) return llmStatisticsT("title")
    if (pathname.startsWith("/settings/mobile")) return mobileSettingsT("title")
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
    mobileSettingsT,
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
      {showBackToMobileSettings ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 gap-1 px-2"
          onClick={() => router.push('/settings/mobile')}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="text-xs">{mobileSettingsT('backAction')}</span>
        </Button>
      ) : null}
      <Separator orientation="vertical" className="mx-2 h-4" />
      <h1 className="text-base font-medium">{title}</h1>
    </div>
  )
}
