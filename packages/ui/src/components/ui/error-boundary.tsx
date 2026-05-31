"use client"

import React from "react"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "./button"

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
          <div className="max-w-md text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--hisab-destructive)]/10">
              <AlertTriangle
                className="size-8 text-[var(--hisab-destructive)]"
                aria-hidden
              />
            </div>
            <h2 className="mb-2 text-xl font-bold text-[var(--hisab-foreground)]">
              مشکلی پیش آمد
            </h2>
            <p className="mb-6 text-sm text-[var(--hisab-muted-fg)]">
              اطلاعات شما از بین نرفته است. لطفاً دوباره تلاش کنید.
            </p>
            <Button
              variant="outline"
              onClick={this.handleReset}
              icon={
                <RefreshCw className="size-4" aria-hidden />
              }
            >
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