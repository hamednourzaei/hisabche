// @vitest-environment jsdom
// ============================================
// Opening a dropdown must not crash the page.
//
// ---------------------------------------------------------------------------
// WHAT HAPPENED
//
// Radix's `MenuPortal` renders `<PortalPrimitive asChild>{children}</...>`.
// `asChild` means Slot, and Slot requires exactly ONE React element child.
//
// `LedgerContent` put the finance-tone ink line inside the SAME `<Portal>` as
// the content:
//
//     <Portal>
//       {tone === 'finance' && <div />}
//       <Content>...</Content>
//     </Portal>
//
// For the default `filter` tone that expression is `false` -- and `false` is
// still a child. React handed Slot an array of two and Radix threw:
//
//     Primitive.div failed to slot onto its children.
//     Expected a single React element child or `Slottable`.
//
// The fault was in the wrapper, so EVERY consumer was affected: the invoice
// grid toolbar, the mobile builder, the dashboard header. It stayed hidden
// while no menu sat on a page people open constantly -- the moment one did, it
// showed up in production as a caught boundary error on every dashboard load.
//
// This file opens the menu at each tone. A regression is a thrown error, not a
// subtle visual difference, so the assertion is simply "it renders".
// ============================================

import * as React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../dropdown-menu'

afterEach(cleanup)

/** `defaultOpen` so the portal mounts during render -- where the crash was. */
function Menu({ tone, children }: { tone?: 'filter' | 'finance'; children?: React.ReactNode }) {
  return (
    <DropdownMenu defaultOpen>
      <DropdownMenuTrigger>open</DropdownMenuTrigger>
      <DropdownMenuContent align="end" {...(tone ? { tone } : {})}>
        {children ?? <DropdownMenuItem>one</DropdownMenuItem>}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('the portal receives one child per portal', () => {
  it('the DEFAULT tone opens -- this is the one that crashed', () => {
    expect(() => render(<Menu />)).not.toThrow()
    expect(screen.getByText('one')).toBeTruthy()
  })

  it('the explicit filter tone opens', () => {
    expect(() => render(<Menu tone="filter" />)).not.toThrow()
  })

  it('the finance tone opens -- the branch that renders the ink line', () => {
    expect(() => render(<Menu tone="finance" />)).not.toThrow()
    expect(screen.getByText('one')).toBeTruthy()
  })
})

describe('a realistic menu, as the header builds one', () => {
  it('renders a label, a separator, arbitrary markup and several items', () => {
    expect(() =>
      render(
        <Menu>
          <DropdownMenuLabel>members</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {/* Raw markup, as the account menu uses for the address block. */}
          <div>
            <p>Hamed</p>
            <p>someone@example.com</p>
          </div>
          <DropdownMenuSeparator />
          {/* A STRING child -- not a React element. */}
          <DropdownMenuItem>sign out</DropdownMenuItem>
          {/* Two element children. */}
          <DropdownMenuItem>
            <span>name</span>
            <span>role</span>
          </DropdownMenuItem>
          {/* ⚠️ THE CONSTANT IS THE TEST.
              `{false && <X/>}` renders the value `false` as a child, and a
              Slot with two children throws. Writing it any other way — a
              variable, a prop — would test a different thing than the JSX that
              actually broke, so the rule is silenced here rather than the code
              being bent around it. */}
          {/* eslint-disable-next-line no-constant-binary-expression */}
          {false && <DropdownMenuItem>never</DropdownMenuItem>}
        </Menu>,
      ),
    ).not.toThrow()

    expect(screen.getByText('sign out')).toBeTruthy()
    expect(screen.getByText('someone@example.com')).toBeTruthy()
  })

  it('an empty menu does not throw either', () => {
    // `{[].map(...)}` renders an empty array. Another shape that is not one
    // element.
    expect(() => render(<Menu>{[]}</Menu>)).not.toThrow()
  })
})
