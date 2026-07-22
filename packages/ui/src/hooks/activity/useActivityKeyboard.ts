// packages/ui/src/hooks/activity/useActivityKeyboard.ts
"use client";

import { useEffect, useCallback, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

export interface UseActivityKeyboardOptions {
  shortcuts?: KeyboardShortcut[];
  onEscape?: () => void;
  onEnter?: () => void;
  onArrowDown?: () => void;
  onArrowUp?: () => void;
  onSearch?: () => void;
  onMarkRead?: () => void;
  onSelectAll?: () => void;
  onDelete?: () => void;
  enabled?: boolean;
}

// ─── Default shortcuts ──────────────────────────────────────────────────────

export const DEFAULT_ACTIVITY_SHORTCUTS: KeyboardShortcut[] = [
  { key: "j", description: "انتقال به پایین", action: () => {} },
  { key: "k", description: "انتقال به بالا", action: () => {} },
  { key: "Enter", description: "باز کردن انتخاب", action: () => {} },
  { key: "Escape", description: "بستن", action: () => {} },
  { key: "/", description: "جستجو", action: () => {} },
  { key: "r", ctrl: true, description: "علامت‌گذاری به عنوان خوانده‌شده", action: () => {} },
  { key: "a", ctrl: true, description: "انتخاب همه", action: () => {} },
  { key: "Delete", description: "حذف", action: () => {} },
];

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useActivityKeyboard({
  shortcuts = [],
  onEscape,
  onEnter,
  onArrowDown,
  onArrowUp,
  onSearch,
  onMarkRead,
  onSelectAll,
  onDelete,
  enabled = true,
}: UseActivityKeyboardOptions = {}) {
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputElements = useRef<Set<HTMLElement>>(new Set());

  // ─── Check if target is input ────────────────────────────────────────────
  const isInputElement = useCallback((target: EventTarget | null): boolean => {
    if (!target) return false;
    const el = target as HTMLElement;
    return (
      el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.contentEditable === "true" ||
      el.getAttribute("role") === "textbox" ||
      el.getAttribute("role") === "searchbox" ||
      el.closest?.('[contenteditable="true"]') !== null
    );
  }, []);

  // ─── Handle keydown ──────────────────────────────────────────────────────
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      const target = e.target as HTMLElement;

      // ─── Update input focus state ──────────────────────────────────────
      const isInput = isInputElement(target);
      setIsInputFocused(isInput);

      // ─── If in input, allow default behavior except for Escape ────────
      if (isInput) {
        if (e.key === "Escape") {
          e.preventDefault();
          (target as HTMLInputElement)?.blur?.();
          onEscape?.();
        }
        return;
      }

      // ─── Check for shortcuts ────────────────────────────────────────────
      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;
      const alt = e.altKey;

      // ─── Built-in shortcuts ─────────────────────────────────────────────
      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onEscape?.();
          return;

        case "Enter":
          e.preventDefault();
          onEnter?.();
          return;

        case "ArrowDown":
        case "j":
          if (!ctrl && !shift && !alt) {
            e.preventDefault();
            onArrowDown?.();
          }
          return;

        case "ArrowUp":
        case "k":
          if (!ctrl && !shift && !alt) {
            e.preventDefault();
            onArrowUp?.();
          }
          return;

        case "/":
          if (!ctrl && !shift && !alt) {
            e.preventDefault();
            onSearch?.();
          }
          return;

        case "r":
          if (ctrl) {
            e.preventDefault();
            onMarkRead?.();
          }
          return;

        case "a":
          if (ctrl) {
            e.preventDefault();
            onSelectAll?.();
          }
          return;

        case "Delete":
        case "Backspace":
          if (!isInput) {
            e.preventDefault();
            onDelete?.();
          }
          return;
      }

      // ─── Custom shortcuts ───────────────────────────────────────────────
      for (const shortcut of shortcuts) {
        const keyMatch = shortcut.key === e.key;
        const ctrlMatch = shortcut.ctrl ? ctrl : !shortcut.ctrl;
        const shiftMatch = shortcut.shift ? shift : !shortcut.shift;
        const altMatch = shortcut.alt ? alt : !shortcut.alt;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    },
    [
      enabled,
      isInputElement,
      shortcuts,
      onEscape,
      onEnter,
      onArrowDown,
      onArrowUp,
      onSearch,
      onMarkRead,
      onSelectAll,
      onDelete,
    ]
  );

  // ─── Register input elements ─────────────────────────────────────────────
  const registerInput = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    inputElements.current.add(element);
    return () => {
      inputElements.current.delete(element);
    };
  }, []);

  // ─── Focus management ────────────────────────────────────────────────────
  const focusNext = useCallback(() => {
    const focusable = document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const current = document.activeElement as HTMLElement;
    let index = -1;

    for (let i = 0; i < focusable.length; i++) {
      if (focusable[i] === current) {
        index = i;
        break;
      }
    }

    const next = focusable[(index + 1) % focusable.length];
    if (next) next.focus();
  }, []);

  const focusPrevious = useCallback(() => {
    const focusable = document.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const current = document.activeElement as HTMLElement;
    let index = -1;

    for (let i = 0; i < focusable.length; i++) {
      if (focusable[i] === current) {
        index = i;
        break;
      }
    }

    const prev = focusable[(index - 1 + focusable.length) % focusable.length];
    if (prev) prev.focus();
  }, []);

  // ─── Restore focus ───────────────────────────────────────────────────────
  const restoreFocus = useCallback((element?: HTMLElement | null) => {
    if (element) {
      element.focus();
    } else {
      const focusable = document.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
  }, []);

  // ─── Get shortcut label ──────────────────────────────────────────────────
  const getShortcutLabel = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = [];
    if (shortcut.ctrl) parts.push("Ctrl");
    if (shortcut.shift) parts.push("Shift");
    if (shortcut.alt) parts.push("Alt");
    if (shortcut.meta) parts.push("⌘");
    parts.push(shortcut.key.toUpperCase());
    return parts.join(" + ");
  }, []);

  // ─── Get all shortcuts with descriptions ─────────────────────────────────
  const allShortcuts = useCallback((): KeyboardShortcut[] => {
    const defaultWithActions = DEFAULT_ACTIVITY_SHORTCUTS.map((s) => {
      const actionMap: Record<string, () => void> = {
        j: onArrowDown || (() => {}),
        k: onArrowUp || (() => {}),
        Enter: onEnter || (() => {}),
        Escape: onEscape || (() => {}),
        "/": onSearch || (() => {}),
        r: onMarkRead || (() => {}),
        a: onSelectAll || (() => {}),
        Delete: onDelete || (() => {}),
      };
      return {
        ...s,
        action: actionMap[s.key] || s.action || (() => {}),
      };
    });

    return [...defaultWithActions, ...shortcuts];
  }, [shortcuts, onArrowDown, onArrowUp, onEnter, onEscape, onSearch, onMarkRead, onSelectAll, onDelete]);

  // ─── Effect ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled) return;

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [enabled, handleKeyDown]);

  // ─── Return ──────────────────────────────────────────────────────────────
  return {
    isInputFocused,
    registerInput,
    focusNext,
    focusPrevious,
    restoreFocus,
    getShortcutLabel,
    allShortcuts: allShortcuts(),
  };
}