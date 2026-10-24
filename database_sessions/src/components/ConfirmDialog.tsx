import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ProblemAlert } from './ProblemAlert';

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Escape runs onCancel by default; set false when cancelling has side effects (e.g. sign out). */
  cancelOnEscape?: boolean;
  destructive?: boolean;
  pending?: boolean;
  error?: unknown;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Native modal <dialog>: showModal() makes the rest of the page inert, so focus is trapped and
 * Escape cancels, without a focus-trap library.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  cancelOnEscape = true,
  destructive = false,
  pending = false,
  error,
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending && cancelOnEscape) onCancel();
      }}
    >
      {open && (
        <>
          <h2 id={titleId}>{title}</h2>
          <div id={bodyId} className="dialog-body">
            {children}
          </div>
          <ProblemAlert error={error} />
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={onCancel} disabled={pending} autoFocus>
              {cancelLabel}
            </button>
            <button
              type="button"
              className={destructive ? 'btn btn-danger' : 'btn btn-primary'}
              onClick={onConfirm}
              disabled={pending}
            >
              {pending ? 'Working…' : confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
