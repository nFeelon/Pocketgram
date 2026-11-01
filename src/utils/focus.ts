export const FOCUSABLE_CSS_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), *[tabindex], *[contenteditable]'

export function findFirstFocusable(container: HTMLElement | null) {
  return container?.querySelector<HTMLElement>(FOCUSABLE_CSS_SELECTOR) ?? null
}

export const autoFocusFirstFocusable = (element: HTMLElement | null) => {
  findFirstFocusable(element)?.focus()
}

export const autoFocus = (element: HTMLElement | null) => element?.focus()
