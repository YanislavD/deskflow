import { useEffect, useState } from 'react'

/** Gibt den Wert erst zurück, wenn er `delay` ms unverändert blieb (z. B. nach dem Tippen). */
export function useDebouncedValue<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
