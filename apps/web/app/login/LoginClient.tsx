"use client"

import React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail, Lock } from 'lucide-react'
import { Button, Input } from '@hisabche/ui'
import { useAuthStore } from '@hisabche/store'
import { loginSchema, type LoginInput } from '@hisabche/validation'

export default function LoginClient() {
  const router = useRouter()
  const login = useAuthStore((s) => s.login)
  const isLoading = useAuthStore((s) => s.isLoading)
  const error = useAuthStore((s) => s.error)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const handleDemoLogin = async () => {
    await login({ email: 'demo@hisabche.com', password: 'Demo1234' })
    router.push('/')
  }

  const onSubmit = async (data: LoginInput) => {
    await login(data)
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--hisab-background)]">
      <div className="w-full max-w-md p-6">
        <h1 className="text-xl font-bold mb-6">ورود</h1>
        {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input type="email" placeholder="email" leftIcon={<Mail />} {...register('email')} error={errors.email?.message} />
          <Input type="password" placeholder="password" leftIcon={<Lock />} {...register('password')} error={errors.password?.message} />
          <Button type="submit" loading={isLoading} fullWidth>ورود</Button>
        </form>
        <Button variant="outline" fullWidth onClick={handleDemoLogin} className="mt-4">Demo Login</Button>
      </div>
    </div>
  )
}