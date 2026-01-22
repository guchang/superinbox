"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
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

// Login form validation schema
const loginSchema = z.object({
  username: z.string().min(1, "请输入用户名"),
  password: z.string().min(6, "密码至少6位"),
})

type LoginFormValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [showPassword, setShowPassword] = React.useState(false)

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
      toast.success("登录成功")
      router.push("/")
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "登录失败")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="font-login-body flex min-h-screen items-center justify-center bg-[#fafafa] px-4 relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-slate-100 to-transparent rounded-full blur-3xl opacity-60 -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-gradient-to-tl from-slate-100 to-transparent rounded-full blur-3xl opacity-60 translate-x-1/3 translate-y-1/3" />

        <Card className="w-full max-w-md border-slate-200/60 shadow-[0_2px_8px_rgba(0,0,0,0.04),0_8px_32px_rgba(0,0,0,0.04)] bg-white/80 backdrop-blur-sm animate-fade-in-up">
          <CardHeader className="space-y-3 pt-8 pb-4">
            {/* Brand mark */}
            <div className="flex justify-center mb-2 animate-fade-in-up delay-100">
              <div className="w-12 h-12 rounded-xl bg-slate-900 flex items-center justify-center shadow-lg shadow-slate-900/20">
                <span className="text-white font-bold text-xl font-login-heading">S</span>
              </div>
            </div>

            <CardTitle className="text-2xl font-semibold text-slate-900 text-center font-login-heading animate-fade-in-up delay-200">
              SuperInbox
            </CardTitle>

            <CardDescription className="text-slate-500 text-center animate-fade-in-up delay-300">
              智能收件箱管理后台
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-2 pb-6 px-8 animate-fade-in-up delay-400">
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              {/* Username field */}
              <div className="space-y-2 group">
                <Label
                  htmlFor="username"
                  className="text-sm font-medium text-slate-700 group-focus-within:text-slate-900 transition-colors"
                >
                  用户名
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="请输入用户名"
                    autoComplete="username"
                    disabled={isLoading}
                    className="h-11 border-slate-200 focus:border-slate-900 focus:ring-slate-900/20 transition-all duration-200 bg-white/50"
                    {...form.register("username")}
                  />
                  <div className="absolute inset-0 rounded-md ring-2 ring-slate-900/20 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200" />
                </div>
                {form.formState.errors.username && (
                  <InlineError message={form.formState.errors.username.message} />
                )}
              </div>

              {/* Password field */}
              <div className="space-y-2 group">
                <Label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-700 group-focus-within:text-slate-900 transition-colors"
                >
                  密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    disabled={isLoading}
                    className="h-11 border-slate-200 focus:border-slate-900 focus:ring-slate-900/20 transition-all duration-200 bg-white/50 pr-10"
                    {...form.register("password")}
                  />
                  <div className="absolute inset-0 rounded-md ring-2 ring-slate-900/20 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-200" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150"
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
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
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-lg shadow-slate-900/20 hover:shadow-xl hover:shadow-slate-900/30 transition-all duration-200 group"
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <>
                    登录
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col space-y-2 pb-8 pt-0 animate-fade-in-up delay-400">
            <div className="text-sm text-slate-500 text-center">
              还没有账号？{" "}
              <Link
                href="/register"
                className="text-slate-900 font-medium hover:text-slate-700 transition-colors duration-150 inline-flex items-center gap-0.5 group"
              >
                立即注册
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform duration-150" />
              </Link>
            </div>
          </CardFooter>
        </Card>
      </div>
  )
}
