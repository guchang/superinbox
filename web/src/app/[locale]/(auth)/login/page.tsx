"use client"

import * as React from "react"
import { useTranslations } from 'next-intl'
import { Link, useRouter } from '@/i18n/navigation'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { InlineError } from "@/components/ui/inline-error"
import { useAuth } from "@/lib/hooks/use-auth"
import { toast } from "sonner"
import { getApiErrorMessage } from '@/lib/i18n/api-errors'

export default function LoginPage() {
  const t = useTranslations('auth.login')
  const errors = useTranslations('errors')
  const router = useRouter()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

  const loginSchema = React.useMemo(() => z.object({
    username: z.string().min(1, t('errors.usernameRequired')),
    password: z.string().min(6, t('errors.passwordMin')),
  }), [t])

  type LoginFormValues = z.infer<typeof loginSchema>

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  })

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true)

    try {
      await login(data)
      toast.success(t('toast.success'))
      router.push('/inbox')
      router.refresh()
    } catch (error) {
      toast.error(getApiErrorMessage(error, errors, t('toast.failure')))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="font-login-body flex min-h-screen items-center justify-center bg-background px-4 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-muted/70 to-transparent dark:from-muted/40 rounded-full blur-3xl opacity-60 dark:opacity-40 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tl from-muted/70 to-transparent dark:from-muted/40 rounded-full blur-3xl opacity-60 dark:opacity-40 translate-x-1/3 translate-y-1/3" />

        <Card className="w-full max-w-md border-border/60 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.04)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.5)] bg-card/80 backdrop-blur-sm animate-fade-in-up">
          <CardHeader className="space-y-3 pt-8 pb-4">
            {/* Brand mark */}
            <div className="flex justify-center mb-2 animate-fade-in-up delay-100">
              <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-black/20 dark:shadow-black/40">
                <span className="text-primary-foreground font-bold text-xl font-login-heading">S</span>
              </div>
            </div>

            <CardTitle className="text-2xl font-semibold text-center font-login-heading animate-fade-in-up delay-200">
              {t('brand')}
            </CardTitle>

            <CardDescription className="text-center animate-fade-in-up delay-300">
              {t('tagline')}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 pb-6 px-8 animate-fade-in-up delay-400">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Username field */}
              <div className="space-y-2 group">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-muted-foreground group-focus-within:text-foreground transition-colors"
                >
                  {t('fields.username.label')}
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder={t('fields.username.placeholder')}
                    autoComplete="username"
                    disabled={isLoading}
                    className="h-11 bg-background/50 transition-all duration-200"
                    {...form.register("username")}
                  />
                  <div className="absolute inset-0 rounded-md ring-2 ring-ring/30 dark:ring-ring/40 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200" />
                </div>
                {form.formState.errors.username && (
                  <InlineError message={form.formState.errors.username.message} />
                )}
              </div>

              {/* Password field */}
              <div className="space-y-2 group">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-muted-foreground group-focus-within:text-foreground transition-colors"
                >
                  {t('fields.password.label')}
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={t('fields.password.placeholder')}
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-11 bg-background/50 transition-all duration-200 pr-10"
                    {...form.register("password")}
                  />
                  <div className="absolute inset-0 rounded-md ring-2 ring-ring/30 dark:ring-ring/40 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    aria-label={showPassword ? t('actions.hidePassword') : t('actions.showPassword')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <InlineError message={form.formState.errors.password.message} />
                )}
              </div>

              {/* Submit button */}
              <Button
                type="submit"
                className="w-full h-11 bg-primary hover:bg-primary/90 text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-200 group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    {t('actions.submit')}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 pb-8 pt-0 animate-fade-in-up delay-400">
            <div className="text-sm text-muted-foreground text-center">
              {t('noAccount')}{' '}
              <Link
                href="/register"
                className="text-foreground font-medium hover:text-foreground/80 transition-colors duration-150 inline-flex items-center gap-0.5 group"
              >
                {t('actions.register')}
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
  )
}
