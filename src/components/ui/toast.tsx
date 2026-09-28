import { Toast } from '@base-ui/react/toast'
import { CheckCircle2, CircleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './button'

export const toastManager = Toast.createToastManager()
export function notify(title: string) {
  toastManager.add({ title, type: 'success' })
}
export function reportError(error: unknown) {
  toastManager.add({
    title:
      error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.',
    type: 'error',
    timeout: 8000,
  })
}
function ToastList() {
  const { toasts } = Toast.useToastManager()
  return (
    <Toast.Portal>
      <Toast.Viewport
        className="fixed right-4 bottom-5 z-[100] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2"
        aria-label="Notifications"
      >
        {toasts.map((toast) => (
          <Toast.Root
            key={toast.id}
            toast={toast}
            className="flex items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg transition duration-200 data-ending-style:translate-x-6 data-ending-style:opacity-0 data-starting-style:translate-y-6 data-starting-style:opacity-0 data-limited:hidden"
          >
            {toast.type === 'error' ? (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
            ) : (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            )}
            <Toast.Content className="flex-1">
              <Toast.Title className="text-sm font-medium" />
              <Toast.Description className="mt-1 text-xs text-muted-foreground" />
              {toast.actionProps && (
                <Toast.Action
                  render={
                    <Button variant="secondary" size="sm" className="mt-2" />
                  }
                />
              )}
            </Toast.Content>
            <Toast.Close
              render={
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Dismiss notification"
                />
              }
            >
              <X />
            </Toast.Close>
          </Toast.Root>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  )
}
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider toastManager={toastManager}>
      {children}
      <ToastList />
    </Toast.Provider>
  )
}
