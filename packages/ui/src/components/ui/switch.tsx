// packages/ui/src/components/ui/switch.tsx
"use client";

import { Switch as ChakraSwitch, type SwitchRootProps } from "@chakra-ui/react";

/* ═══════════════════════════════════════════════════════════════════════════
   Switch v3 — Chakra UI
   ═══════════════════════════════════════════════════════════════════════════ */

function Switch({ label, ...props }: SwitchRootProps & { label?: string }) {
  return (
    <ChakraSwitch.Root {...props}>
      <ChakraSwitch.HiddenInput />
      <ChakraSwitch.Control />
      {label && <ChakraSwitch.Label>{label}</ChakraSwitch.Label>}
    </ChakraSwitch.Root>
  );
}

export { Switch };