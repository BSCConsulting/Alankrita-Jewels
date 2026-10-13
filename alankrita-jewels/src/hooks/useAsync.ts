import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | null
  reload: () => void
}

/** Minimal data-fetching hook that ignores stale responses when deps change mid-flight. */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [tick, setTick] = useState(0)
  const requestId = useRef(0)

  useEffect(() => {
    const id = ++requestId.current
    setLoading(true)
    setError(null)
    fn()
      .then((result) => id === requestId.current && setData(result))
      .catch((err: unknown) => id === requestId.current && setError(err instanceof Error ? err : new Error(String(err))))
      .finally(() => id === requestId.current && setLoading(false))
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, loading, error, reload }
}
