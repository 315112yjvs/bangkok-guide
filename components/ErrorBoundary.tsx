'use client'
import { Component, type ReactNode } from 'react'

type Props = { fallback: ReactNode; children: ReactNode }
type State = { hasError: boolean }

// 包住可能在 render 或 effect 拋錯的子樹（例如 Google Maps），
// 壞掉時只顯示 fallback，不會讓整頁白屏。
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error)
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}
