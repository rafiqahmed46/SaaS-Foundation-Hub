export const CURRENCIES: Record<string, string> = {
  AED: "AED", USD: "$", EUR: "€", GBP: "£", SAR: "SAR", QAR: "QAR",
  KWD: "KWD", BHD: "BHD", OMR: "OMR", JPY: "¥", CAD: "C$", AUD: "A$",
  INR: "₹", BRL: "R$", MXN: "MX$", SGD: "S$", CHF: "CHF", PKR: "₨", EGP: "E£",
};

export function getCurrencySymbol(currency: string) {
  return CURRENCIES[currency] || currency;
}

export function fmtDate(dateStr: string | undefined) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-AE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
