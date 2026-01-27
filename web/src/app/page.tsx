import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { routing } from '@/i18n/routing'

export default async function RootPage() {
  const cookieStore = await cookies()
  const token = cookieStore.get('superinbox_auth_token')?.value
  const destination = token ? '/inbox' : '/login'
  redirect(`/${routing.defaultLocale}${destination}`)
}
