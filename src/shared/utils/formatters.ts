export function normalizeCNPJ(value: string | undefined | null): string {
  return value?.replace(/\D/g, '') || '';
}

export function isValidCNPJ(value: string | undefined | null): boolean {
  const digits = normalizeCNPJ(value);
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;

  const calculateDigit = (length: number) => {
    let factor = length - 7;
    let total = 0;

    for (let index = 0; index < length; index += 1) {
      total += Number(digits[index]) * factor;
      factor -= 1;
      if (factor < 2) factor = 9;
    }

    const remainder = total % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  return calculateDigit(12) === Number(digits[12])
    && calculateDigit(13) === Number(digits[13]);
}

export function formatCNPJ(value: string | undefined | null): string {
  if (!value) return '';
  const digits = normalizeCNPJ(value);
  if (digits.length !== 14) return value;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function maskCNPJ(value: string): string {
  let v = normalizeCNPJ(value);
  if (v.length > 14) v = v.substring(0, 14);
  v = v.replace(/^(\d{2})(\d)/, "$1.$2");
  v = v.replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3");
  v = v.replace(/\.(\d{3})(\d)/, ".$1/$2");
  v = v.replace(/(\d{4})(\d)/, "$1-$2");
  return v;
}
