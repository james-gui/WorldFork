import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

type KeyHandler = (e: KeyboardEvent) => void;

/**
 * Map of sequence shortcuts: first key -> second key -> route/action.
 * E.g., pressing "g" then "r" navigates to /runs.
 */
const SEQUENCE_SHORTCUTS: Record<string, Record<string, string>> = {
  g: {
    r: '/runs',
    d: '/dashboard',
    j: '/jobs',
    s: '/settings',
    l: '/logs',
    n: '/runs/new',
  },
};

/**
 * useGlobalKeyboard — mounts global keyboard shortcuts.
 *
 * - Cmd/Ctrl+K: dispatches a custom event to open the command palette.
 * - Sequence shortcuts (g r, g d, g j, g s) for navigation.
 *
 * Shortcuts are suppressed when the user is focused on an input/textarea/select.
 */
export function useGlobalKeyboard(
  onCommandPaletteOpen?: () => void
): void {
  const router = useRouter();
  const sequenceRef = useRef<string | null>(null);
  const sequenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInputFocused = useCallback((): boolean => {
    const el = document.activeElement;
    if (!el) return false;
    const tag = el.tagName.toLowerCase();
    return (
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'select' ||
      (el as HTMLElement).contentEditable === 'true'
    );
  }, []);

  const clearSequence = useCallback(() => {
    sequenceRef.current = null;
    if (sequenceTimerRef.current) {
      clearTimeout(sequenceTimerRef.current);
      sequenceTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown: KeyHandler = (e) => {
      if (isInputFocused()) return;

      // Cmd+K or Ctrl+K -> open command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (onCommandPaletteOpen) {
          onCommandPaletteOpen();
        } else {
          // Dispatch custom event that CommandPalette listens to
          document.dispatchEvent(new CustomEvent('worldfork:open-command-palette'));
        }
        return;
      }

      // Skip if any modifier key is held
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();

      // Sequence handling
      if (sequenceRef.current !== null) {
        const firstKey = sequenceRef.current;
        clearSequence();

        if (SEQUENCE_SHORTCUTS[firstKey]?.[key]) {
          e.preventDefault();
          router.push(SEQUENCE_SHORTCUTS[firstKey][key]);
        }
        return;
      }

      // Start a sequence if the key is a known sequence starter
      if (SEQUENCE_SHORTCUTS[key]) {
        e.preventDefault();
        sequenceRef.current = key;
        // Clear sequence after 1.5s if no second key pressed
        sequenceTimerRef.current = setTimeout(() => {
          clearSequence();
        }, 1500);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      clearSequence();
    };
  }, [router, onCommandPaletteOpen, isInputFocused, clearSequence]);
}
