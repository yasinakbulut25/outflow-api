// Saf TS yardımcıları — web istemcisiyle birebir aynı (SPEC.md §9).
// Sunucu tarafında yalnız taksit takvimi (generateInstallmentSchedule) kullanılır,
// ancak tutarlılık için tüm dosya korunur.

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('tr-TR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function parseCurrencyInput(rawDigits: string): number {
  if (!rawDigits) return 0;
  const padded = rawDigits.padStart(3, '0');
  const intPart = padded.slice(0, -2);
  const decPart = padded.slice(-2);
  return parseFloat(`${intPart || '0'}.${decPart}`);
}

export function getMonthName(monthIndex: number): string {
  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
  ];
  return months[monthIndex - 1] ?? '';
}

export function calculateInstallmentAmount(total: number, count: number): number {
  return Math.round((total / count) * 100) / 100;
}

// Taksit takvimi satın alınan aydan başlar (1. taksit = alım ayı).
export function getInstallmentStartMonth(expenseDate: string): Date {
  const d = new Date(expenseDate + 'T00:00:00');
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function generateInstallmentSchedule(
  expenseDate: string,
  totalAmount: number,
  installmentCount: number
): Array<{ date: string; amount: number; installmentNo: number }> {
  const monthlyAmount = calculateInstallmentAmount(totalAmount, installmentCount);
  // 1. taksit = alım ayı. Ay anahtarı tamsayı aritmetiğiyle üretilir; `new Date(...).toISOString()`
  // yerel gece yarısını UTC'ye çevirip UTC+ saat dilimlerinde ayın 1'ini bir geri kaydırırdı.
  const [year, month] = expenseDate.slice(0, 7).split('-').map(Number); // month: 1-12
  const schedule = [];

  for (let i = 0; i < installmentCount; i++) {
    const offset = month - 1 + i; // alım ayından itibaren 0-bazlı
    const y = year + Math.floor(offset / 12);
    const m = (offset % 12) + 1;
    schedule.push({
      date: `${y}-${String(m).padStart(2, '0')}`,
      amount: monthlyAmount,
      installmentNo: i + 1,
    });
  }

  return schedule;
}
