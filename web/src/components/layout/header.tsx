"use client"

import { useMemo } from "react"
import { useTranslations } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { useIsMobile } from "@/hooks/use-mobile"
import { Link } from "@/i18n/navigation"

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
    if (pathname === "/dashboard" || pathname === "") return dashboardT("title")
    if (pathname.startsWith("/inbox/")) return inboxDetailT("title")
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

  // 是否是收件箱详情页
  const isInboxDetailPage = pathname.startsWith("/inbox/") && pathname !== "/inbox"

  if (!title && !isInboxDetailPage) {
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

      {/* 面包屑导航：详情页显示"收件箱 / 条目详情" */}
      {isInboxDetailPage ? (
        <nav className="flex items-center gap-1.5 text-sm">
          <Link
            href="/inbox"
            className="text-muted-foreground hover:text-foreground transition-colors group"
          >
            <span className="group-hover:underline underline-offset-2 decoration-foreground/30">
              {inboxT("title")}
            </span>
          </Link>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-foreground font-medium">{inboxDetailT("breadcrumb.detail")}</span>
        </nav>
      ) : (
        <h1 className="text-base font-medium">{title}</h1>
      )}
    </div>
  )
}
