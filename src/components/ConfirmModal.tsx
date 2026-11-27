import { useEffect, useId, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export type ConfirmVariant = 'primary' | 'warning' | 'danger' | 'success';

export interface ConfirmDetail {
  label: string;
  value: ReactNode;
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  details?: ConfirmDetail[];
  /** Tinted callout under the details (e.g. "A QR pass email will be sent…"). */
  notice?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmingLabel?: string;
  confirming?: boolean;
  variant?: ConfirmVariant;
  /** Single-button acknowledgment mode (used by SuccessModal). */
  hideCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const VARIANT_UI: Record<
  ConfirmVariant,
  { icon: string; notice: string; confirm: string }
> = {
  primary: {
    icon: 'bg-violet-100/90 text-violet-600',
    notice: 'bg-white/60 ring-1 ring-white/80',
    confirm: 'liquid-btn-primary',
  },
  warning: {
    icon: 'bg-amber-100/90 text-amber-600',
    notice: 'bg-amber-50/70 ring-2 ring-amber-400/30',
    confirm: 'bg-amber-500 text-white hover:bg-amber-600',
  },
  danger: {
    icon: 'bg-rose-100/90 text-rose-600',
    notice: 'bg-rose-50/60 ring-2 ring-rose-400/35',
    confirm: 'bg-rose-500 text-white hover:bg-rose-600',
  },
  success: {
    icon: 'bg-emerald-100/90 text-emerald-600',
    notice: 'bg-emerald-50/70 ring-2 ring-emerald-400/30',
    confirm: 'bg-emerald-500 text-white hover:bg-emerald-600',
  },
};

export default function ConfirmModal({
  open,
  title,
  description,
  details,
  notice,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmingLabel = 'Working…',
  confirming = false,
  variant = 'primary',
  hideCancel = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const ui = VARIANT_UI[variant];
  const Icon = variant === 'primary' || variant === 'success' ? CheckCircle2 : AlertTriangle;

  // Capture phase + stopPropagation so Escape only closes this dialog,
  // never the form modal underneath it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      if (!confirming) onCancel();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, confirming, onCancel]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-900/30 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!confirming) onCancel();
          }}
        >
          <motion.div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descId : undefined}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            className="liquid-glass my-auto w-full max-w-md space-y-4 rounded-3xl p-5 sm:p-6"
          >
            <div className="flex items-start gap-3">
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${ui.icon}`}
              >
                <Icon size={20} />
              </span>
              <div className="min-w-0">
                <h2 id={titleId} className="text-lg font-semibold text-slate-800">
                  {title}
                </h2>
                {description && (
                  <p id={descId} className="mt-0.5 text-sm font-medium text-slate-600">
                    {description}
                  </p>
                )}
              </div>
            </div>

            {details && details.length > 0 && (
              <dl className="space-y-2 rounded-2xl bg-white/55 px-4 py-3 ring-1 ring-white/80">
                {details.map((d) => (
                  <div key={d.label} className="flex items-start justify-between gap-4 text-sm">
                    <dt className="shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                      {d.label}
                    </dt>
                    <dd className="min-w-0 break-words text-right font-medium text-slate-800">
                      {d.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {notice && (
              <div className={`rounded-2xl px-4 py-3 text-sm text-slate-700 ${ui.notice}`}>
                {notice}
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {!hideCancel && (
                <button
                  type="button"
                  autoFocus={variant === 'danger'}
                  onClick={onCancel}
                  disabled={confirming}
                  className="liquid-glass rounded-full px-5 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-60"
                >
                  {cancelLabel}
                </button>
              )}
              <button
                type="button"
                autoFocus={variant !== 'danger'}
                onClick={onConfirm}
                disabled={confirming}
                className={`flex items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${ui.confirm}`}
              >
                {confirming && <Loader2 size={14} className="animate-spin" />}
                {confirming ? confirmingLabel : confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export interface SuccessReceipt {
  title: string;
  description?: ReactNode;
  details?: ConfirmDetail[];
  notice?: ReactNode;
  /** `warning` = action saved, but a side effect (e.g. email) failed. */
  variant?: 'success' | 'warning';
}

export function SuccessModal({
  receipt,
  onClose,
}: {
  receipt: SuccessReceipt | null;
  onClose: () => void;
}) {
  return (
    <ConfirmModal
      open={receipt !== null}
      variant={receipt?.variant ?? 'success'}
      hideCancel
      title={receipt?.title ?? ''}
      description={receipt?.description}
      details={receipt?.details}
      notice={receipt?.notice}
      confirmLabel="Done"
      onConfirm={onClose}
      onCancel={onClose}
    />
  );
}