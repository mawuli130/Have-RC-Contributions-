export function formatGHS(amount: number | null | undefined, showDecimals = true): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return 'GH₵0.00';
  }
  const rounded = Math.round(amount * 100) / 100;
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);
  const formatted = abs.toLocaleString('en-GH', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${isNegative ? '−' : ''}GH₵${formatted}`;
}

export function formatSignedGHS(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  if (rounded > 0) {
    return `+${formatGHS(rounded)}`;
  }
  if (rounded < 0) {
    return `−${formatGHS(Math.abs(rounded))}`;
  }
  return formatGHS(0);
}

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTimeShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildWhatsAppReminderMessage(params: {
  memberName: string;
  outstandingAmountGhs: number;
  periodLabel: string;
}): string {
  const formattedAmount = roundMoney(params.outstandingAmountGhs).toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const cleanPeriod = params.periodLabel || 'the current contribution period';
  return `Hello ${params.memberName}, this is a friendly reminder from the Have R/C JHS 2022 Old Students group. Our records show that your outstanding contribution balance is GH₵${formattedAmount} for ${cleanPeriod}. If you have already paid, please contact the treasurer so your records can be updated. Thank you.`;
}

export function buildWhatsAppUrl(phone: string | null | undefined, message: string): string {
  const encodedText = encodeURIComponent(message);
  if (!phone || !phone.trim()) {
    return `https://wa.me/?text=${encodedText}`;
  }
  // Convert Ghana local phone e.g. 0241234567 -> 233241234567
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('0') && digits.length === 10) {
    digits = `233${digits.slice(1)}`;
  }
  return `https://wa.me/${digits}?text=${encodedText}`;
}

export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'OS';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
