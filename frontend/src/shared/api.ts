// Общий same-origin транспорт текущего интерфейса; роли и доступ проверяет API.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...options.headers
    }
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      response.status,
      typeof body?.detail === 'string'
        ? body.detail
        : response.status === 422
          ? 'Проверьте обязательные поля, формат дат и значений.'
          : 'Запрос не выполнен. Проверьте подключение к серверу.'
    )
  }
  if (response.status === 204) return undefined as T
  return response.json()
}
