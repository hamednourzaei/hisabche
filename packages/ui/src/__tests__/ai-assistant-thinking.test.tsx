// ============================================
// Reported: while the assistant works on a question, the chat showed a lone
// «●». It now says «thinking» — rendered through the real assistant-ui
// runtime, not asserted from the source.
// ============================================

import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'

import { AiAssistantPanel } from '../components/ui/ai/ai-assistant-panel'

// jsdom has no ResizeObserver; the thread viewport uses one for auto-scroll.
beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollTo ??= () => {}
})

afterEach(cleanup)

const t = (key: string, fallback?: string) =>
  key === 'ai.thinking' ? 'THINKING-LABEL' : (fallback ?? key)
const question = { role: 'user' as const, content: [{ type: 'text' as const, text: 'سلام' }] }

describe('the assistant says it is thinking while an answer is pending', () => {
  it('running: the thinking label is shown, not a bare dot', async () => {
    render(<AiAssistantPanel t={t} messages={[question]} isRunning onSend={() => {}} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('THINKING-LABEL'))
    expect(document.body.textContent).not.toContain(' ●')
  })

  it('answered: the label is gone and the answer is there', async () => {
    render(
      <AiAssistantPanel
        t={t}
        messages={[
          question,
          { role: 'assistant', content: [{ type: 'text', text: 'سلام! چه کمکی؟' }] },
        ]}
        isRunning={false}
        onSend={() => {}}
      />,
    )
    await waitFor(() => expect(document.body.textContent).toContain('سلام! چه کمکی؟'))
    expect(document.querySelector('[data-thinking]')).toBeNull()
  })
})
