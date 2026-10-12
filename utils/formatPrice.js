function formatPrice(price) {
  const trimmed = String(price).trim();
  if (!trimmed) return "SAR 0.00";

  if (/^SAR\s/i.test(trimmed)) {
    const amount = trimmed.replace(/^SAR\s*/i, "").trim();
    const num = parseFloat(amount.replace(/,/g, ""));
    if (!Number.isNaN(num)) {
      return `SAR ${num.toFixed(2)}`;
    }
    return `SAR ${amount}`;
  }

  const numeric = trimmed.replace(/[^0-9.]/g, "");
  const num = parseFloat(numeric);
  if (!Number.isNaN(num)) {
    return `SAR ${num.toFixed(2)}`;
  }

  return `SAR ${trimmed}`;
}

module.exports = { formatPrice };
