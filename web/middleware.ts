import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'

const intlMiddleware = createMiddleware(routing)

// 公开路由（不需要认证）
const publicRoutes = ['/login', '/register']

// 认证路由（需要登录后才能访问）
const protectedRoutes = ['/']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nextAction = request.headers.get('next-action')
  if (nextAction) {
    console.warn('[server-action] unexpected request', {
      method: request.method,
      pathname,
      referer: request.headers.get('referer') || '',
      userAgent: request.headers.get('user-agent') || '',
      nextAction,
    })
  }

  const localeSegment = new RegExp(`^/(${routing.locales.join('|')})(?=/|$)`)
  const localeMatch = pathname.match(localeSegment)
  const token = request.cookies.get('superinbox_auth_token')?.value

  if (!localeMatch) {
    if (pathname === '/') {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = token
        ? `/${routing.defaultLocale}/inbox`
        : `/${routing.defaultLocale}/login`
      return NextResponse.redirect(redirectUrl)
    }
    return intlMiddleware(request)
  }

  const locale = localeMatch[1]
  const pathnameWithoutLocale = pathname.replace(localeSegment, '') || '/'
  if (pathnameWithoutLocale === '/') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = token ? `/${locale}/inbox` : `/${locale}/login`
    return NextResponse.redirect(redirectUrl)
  }

  // 检查是否是公开路由
  const isPublicRoute = publicRoutes.some(route =>
    pathnameWithoutLocale.startsWith(route)
  )

  // 检查是否是受保护路由
  const isProtectedRoute = protectedRoutes.some(route =>
    pathnameWithoutLocale.startsWith(route)
  )

  // 如果访问受保护路由但没有 token，重定向到登录页
  if (isProtectedRoute && !token) {
    const loginUrl = new URL(`/${locale}/login`, request.url)
    return NextResponse.redirect(loginUrl)
  }

  // 如果已登录用户访问登录/注册页，重定向到首页
  if (isPublicRoute && token) {
    const homeUrl = new URL(`/${locale}/inbox`, request.url)
    return NextResponse.redirect(homeUrl)
  }

  return intlMiddleware(request)
}

// 配置匹配路径
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - _next/static (静态文件)
     * - _next/image (图片优化文件)
     * - favicon.ico (favicon 文件)
     * - public folder 中的文件
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
