import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  X,
  XCircle,
} from 'lucide-react';
import type { PublicPaymentStatusLabel } from '../types/database';
import { getInitials } from '../utils/formatters';

/* ---------------------------------------------------------------- */
/* Status pill                                                       */
/* ---------------------------------------------------------------- */

const STATUS_STYLES: Record<PublicPaymentStatusLabel, { cls: string; Icon: typeof Check }> = {
  Paid: { cls: 'pill-paid', Icon: CheckCircle2 },
  'Partially Paid': { cls: 'pill-partial', Icon: Clock },
  'Not Yet Paid': { cls: 'pill-unpaid', Icon: AlertCircle },
  Overdue: { cls: 'pill-unpaid', Icon: XCircle },
  'Pending Verification': { cls: 'pill-pending', Icon: Clock },
  Rejected: { cls: 'pill-unpaid', Icon: XCircle },
  'Schedule Not Set': { cls: 'pill-neutral', Icon: Info },
};

export function StatusPill({ status }: { status: PublicPaymentStatusLabel | string }) {
  const style = STATUS_STYLES[status as PublicPaymentStatusLabel] ?? {
    cls: 'pill-neutral',
    Icon: Info,
  };
  const Icon = style.Icon;
  return (
    <span className={style.cls}>
      <Icon size={12} strokeWidth={3} aria-hidden />
      {status}
    </span>
  );
}

export function SimplePill({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'info' | 'paid' | 'partial' | 'unpaid' | 'pending';
}) {
  const map = {
    neutral: 'pill-neutral',
    info: 'pill-info',
    paid: 'pill-paid',
    partial: 'pill-partial',
    unpaid: 'pill-unpaid',
    pending: 'pill-pending',
  } as const;
  return <span className={map[tone]}>{children}</span>;
}

/* ---------------------------------------------------------------- */
/* Avatars                                                           */
/* ---------------------------------------------------------------- */

export function Avatar({
  name,
  src,
  size = 44,
  ring,
}: {
  name: string;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`shrink-0 rounded-full object-cover ${ring ? 'ring-2 ring-gold-400' : ''}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-navy-900 font-bold text-white ${ring ? 'ring-2 ring-gold-400' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {getInitials(name)}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Stat card                                                         */
/* ---------------------------------------------------------------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  tone?: 'navy' | 'green' | 'red' | 'gold' | 'orange';
  onClick?: () => void;
}) {
  const tones = {
    navy: 'bg-navy-900 text-white',
    green: 'bg-[#1E9E63] text-white',
    red: 'bg-[#B8392F] text-white',
    gold: 'bg-gold-500 text-navy-950',
    orange: 'bg-[#E08A1E] text-white',
  } as const;
  const Wrapper: React.ElementType = onClick ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      className={`card-flat ${onClick ? 'text-left active:scale-[0.99] transition' : ''} flex min-h-[112px] flex-col justify-between p-3.5`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase leading-tight tracking-wide text-navy-600">
          {label}
        </p>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          {icon}
        </span>
      </div>
      <p className="money mt-2 break-words text-[21px] font-extrabold leading-tight text-navy-950">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p> : null}
    </Wrapper>
  );
}

export function MiniStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl bg-[#F7FAFE] border border-[#E8EEF7] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`money mt-0.5 text-[15px] font-extrabold ${tone ?? 'text-navy-950'}`}>{value}</p>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Feedback: alert, toast, empty, loading                            */
/* ---------------------------------------------------------------- */

export function Alert({
  tone = 'info',
  title,
  children,
  onClose,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const tones = {
    info: { wrap: 'bg-navy-50 border-navy-200 text-navy-800', Icon: Info },
    success: { wrap: 'bg-[#E9F8F0] border-[#A9DFC2] text-[#137447]', Icon: CheckCircle2 },
    error: { wrap: 'bg-[#FDECEC] border-[#F0BFBF] text-[#A82B2B]', Icon: XCircle },
    warning: { wrap: 'bg-[#FFF6E6] border-[#F3D9A8] text-[#8A5A08]', Icon: AlertCircle },
  } as const;
  const t = tones[tone];
  const Icon = t.Icon;
  return (
    <div className={`flex gap-2.5 rounded-xl border p-3 ${t.wrap}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon size={17} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-[13.5px] font-bold leading-snug">{title}</p> : null}
        {children ? <div className="text-[12.8px] leading-relaxed">{children}</div> : null}
      </div>
      {onClose ? (
        <button type="button" onClick={onClose} aria-label="Dismiss" className="-mr-1 -mt-1 p-1">
          <X size={15} />
        </button>
      ) : null}
    </div>
  );
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  text: string;
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: string) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] mx-auto flex w-full max-w-[480px] flex-col gap-2 p-3">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onDismiss(t.id)}
          className={`pointer-events-auto animate-slide-up flex items-start gap-2 rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold shadow-lg ${
            t.tone === 'success'
              ? 'bg-[#137447] text-white'
              : t.tone === 'error'
                ? 'bg-[#B8392F] text-white'
                : 'bg-navy-900 text-white'
          }`}
        >
          {t.tone === 'success' ? <CheckCircle2 size={16} className="mt-0.5" /> : t.tone === 'error' ? <XCircle size={16} className="mt-0.5" /> : <Info size={16} className="mt-0.5" />}
          <span className="leading-snug">{t.text}</span>
        </button>
      ))}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-50 text-navy-600">{icon}</div>
      <p className="text-[15px] font-bold text-navy-950">{title}</p>
      <p className="max-w-[280px] text-[13px] leading-relaxed text-slate-500">{description}</p>
      {action ? <div className="mt-2 w-full max-w-[240px]">{action}</div> : null}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-[13px] font-medium text-slate-500">
      <Loader2 size={16} className="animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Modal sheet + confirm dialog                                      */
/* ---------------------------------------------------------------- */

export function Sheet({
  open,
  title,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/50 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="absolute inset-0 h-full w-full cursor-default" aria-label="Close" onClick={onClose} />
      <div className="animate-slide-up relative z-10 flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3 border-b border-[#EDF2F9] px-4 py-3.5">
          <h2 className="text-[16px] font-bold leading-snug text-navy-950">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X size={19} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        {footer ? <div className="border-t border-[#EDF2F9] bg-white p-3 safe-bottom">{footer}</div> : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger' | 'success';
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Sheet open={open} title={title} onClose={onCancel} footer={
      <div className="flex gap-2">
        <button type="button" className="btn-outline flex-1" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`${tone === 'danger' ? 'btn-danger' : tone === 'success' ? 'btn-success' : 'btn-primary'} flex-1`}
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    }>
      <div className="text-[13.5px] leading-relaxed text-slate-600">{message}</div>
    </Sheet>
  );
}

/* ---------------------------------------------------------------- */
/* Screen header & section header                                    */
/* ---------------------------------------------------------------- */

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 bg-navy-900 text-white shadow-[0_4px_18px_rgba(7,31,66,0.25)]">
      <div className="flex items-center gap-2 px-4 py-3.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white hover:bg-white/10 active:scale-95"
          >
            <ChevronRight size={22} className="rotate-180" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold leading-tight text-white">{title}</h1>
          {subtitle ? <p className="truncate text-[12px] leading-tight text-navy-200">{subtitle}</p> : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function SectionHeader({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="section-title">{title}</h2>
        {caption ? <p className="section-caption">{caption}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function InfoNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-500">
      <Info size={13} className="mt-0.5 shrink-0 text-navy-400" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/* ---------------------------------------------------------------- */
/* File input helper                                                 */
/* ---------------------------------------------------------------- */

export interface PickedFile {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
}

export function FilePicker({
  label,
  hint,
  value,
  onChange,
  accept = 'image/*,application/pdf',
}: {
  label: string;
  hint?: string;
  value: PickedFile | null;
  onChange: (file: PickedFile | null) => void;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    setError(null);
    const file = files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError('That file is larger than 3 MB. Please choose a smaller image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        dataUrl: String(reader.result ?? ''),
      });
    };
    reader.onerror = () => setError('The file could not be read. Please try another file.');
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        data-testid={`file-input-${label.toLowerCase().replace(/\s+/g, '-')}`}
        onChange={(e) => handleFiles(e.target.files)}
      />
      {value ? (
        <div className="flex items-center gap-2 rounded-xl border border-[#D8E2F0] bg-[#F7FAFE] p-2.5">
          {value.mimeType.startsWith('image/') ? (
            <img src={value.dataUrl} alt="Selected attachment preview" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-navy-100 text-navy-700">
              <Check size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-navy-950">{value.fileName}</p>
            <p className="text-[11.5px] text-slate-500">{(value.sizeBytes / 1024).toFixed(0)} KB attached</p>
          </div>
          <button type="button" onClick={() => onChange(null)} className="rounded-lg p-2 text-[#A82B2B]" aria-label="Remove attachment">
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex min-h-[104px] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-[#B9D2F0] bg-[#F7FAFE] px-3 py-4 text-center active:scale-[0.99]"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-navy-900 text-gold-400">
            <Camera size={20} aria-hidden />
          </span>
          <span className="text-[13.5px] font-bold text-navy-800">Tap to upload screenshot</span>
          <span className="text-[11px] font-medium text-slate-400">(JPG, PNG)</span>
        </button>
      )}
      {hint ? <p className="field-help">{hint}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Loading button                                                    */
/* ---------------------------------------------------------------- */

export function ActionButton({
  children,
  onClick,
  variant = 'primary',
  busy,
  disabled,
  full,
  type = 'button',
  small,
  testId,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'gold' | 'outline' | 'ghost' | 'danger' | 'success';
  busy?: boolean;
  disabled?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
  small?: boolean;
  testId?: string;
}) {
  const cls = {
    primary: 'btn-primary',
    gold: 'btn-gold',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success',
  }[variant];
  return (
    <button
      type={type}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled || busy}
      className={`${cls} ${full ? '' : 'w-auto'} ${small ? 'btn-sm' : ''}`}
    >
      {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}
