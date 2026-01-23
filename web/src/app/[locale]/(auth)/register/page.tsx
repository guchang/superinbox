"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function RegisterPage() {
  const t = useTranslations('auth.register')
  const errors = useTranslations('errors')
  const router = useRouter()
  const { register } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)

  const registerSchema = React.useMemo(() => z.object({
    username: z.string()
      .min(3, t('errors.usernameMin'))
      .max(20, t('errors.usernameMax')),
    email: z.string().email(t('errors.emailInvalid')),
    password: z.string().min(6, t('errors.passwordMin')),
    confirmPassword: z.string(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('errors.passwordMismatch'),
    path: ['confirmPassword'],
  }), [t])

  type RegisterFormValues = z.infer<typeof registerSchema>

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  })

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true)

    try {
      await register({
        username: data.username,
        email: data.email,
        password: data.password,
      })
      toast.success(t('toast.success'))
      // 注册成功后跳转到首页
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error(getApiErrorMessage(error, errors, t('toast.failure')))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">{t('title')}</CardTitle>
          <CardDescription className="text-center">
            {t('subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">{t('fields.username.label')}</Label>
              <Input
                id="username"
                placeholder={t('fields.username.placeholder')}
                disabled={isLoading}
                {...form.register("username")}
              />
              {form.formState.errors.username && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.username.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t('fields.email.label')}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('fields.email.placeholder')}
                disabled={isLoading}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t('fields.password.label')}</Label>
              <Input
                id="password"
                type="password"
                placeholder={t('fields.password.placeholder')}
                disabled={isLoading}
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">{t('fields.confirmPassword.label')}</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder={t('fields.confirmPassword.placeholder')}
                disabled={isLoading}
                {...form.register("confirmPassword")}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('actions.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <div className="text-sm text-muted-foreground text-center">
            {t('hasAccount')}{' '}
            <Link href="/login" className="text-primary hover:underline">
              {t('actions.login')}
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}
