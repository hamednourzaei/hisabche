"use client"

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from './button'

interface Props {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex min-h-[400px] items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-[var(--hisab-destructive)]/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="size-8 text-[var(--hisab-destructive)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--hisab-foreground)] mb-2">
              مشکلی پیش آمد
            </h2>
            <p className="text-sm text-[var(--hisab-muted-fg)] mb-6">
              اطلاعات شما از بین نرفته است. لطفاً دوباره تلاش کنید.
            </p>
            <Button variant="outline" onClick={this.handleReset} icon={<RefreshCw className="size-4" />}>
              تلاش دوباره
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export { ErrorBoundary }