// Validate structured output from the bill-parsing model before any preview
// or Basecamp write. Unknown fields are dropped so they cannot influence
// later API calls.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const CURRENCY_RE = /^[A-Za-z]{3}$/;
const MAX_VENDOR_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 2000;
const MAX_ABS_AMOUNT = 1e10;

function optionalString(value, field, maxLength) {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null`);
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > maxLength) {
    throw new Error(`${field} exceeds the maximum length of ${maxLength}`);
  }
  return trimmed;
}

function optionalAmount(value) {
  if (value == null) {
    return null;
  }
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error('amount must be a finite number or null');
  }
  if (Math.abs(value) > MAX_ABS_AMOUNT) {
    throw new Error('amount is outside the accepted range');
  }
  return value;
}

function optionalDate(value, field) {
  if (value == null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a YYYY-MM-DD string or null`);
  }
  const match = DATE_RE.exec(value);
  if (!match) {
    throw new Error(`${field} must be a YYYY-MM-DD string`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${field} is not a valid calendar date`);
  }
  return value;
}

function normalizeCurrency(value) {
  if (value == null || value === '') {
    return 'USD';
  }
  if (typeof value !== 'string' || !CURRENCY_RE.test(value.trim())) {
    throw new Error('currency must be a 3-letter ISO currency code');
  }
  return value.trim().toUpperCase();
}

export function validateParsedBill(input) {
  if (input == null || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Model output must be a JSON object');
  }

  return {
    vendor: optionalString(input.vendor, 'vendor', MAX_VENDOR_LENGTH),
    amount: optionalAmount(input.amount),
    currency: normalizeCurrency(input.currency),
    due_date: optionalDate(input.due_date, 'due_date'),
    summary: optionalString(input.summary, 'summary', MAX_SUMMARY_LENGTH),
  };
}

export function parseModelOutput(rawText) {
  if (typeof rawText !== 'string' || rawText.trim().length === 0) {
    throw new Error('Model output was empty');
  }
  let raw = rawText.trim();
  raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Do not include the raw model text: it may contain the bill contents.
    throw new Error('Could not parse model response as JSON');
  }
  return validateParsedBill(data);
}

export function formatAmount(amount, currency) {
  if (amount == null) {
    return '(unknown)';
  }
  const code = currency || 'USD';
  const symbol = code === 'USD' ? '$' : `${code} `;
  return `${symbol}${amount.toFixed(2)}`;
}

export function buildTodoFromParsed(parsed, sourceText) {
  // Re-validate so callers cannot pass untrusted model output straight through.
  const bill = validateParsedBill(parsed);
  if (typeof sourceText !== 'string') {
    throw new Error('Source bill text must be a string');
  }
  const amountStr = formatAmount(bill.amount, bill.currency);
  const title = bill.vendor ? `${bill.vendor} — ${amountStr}` : `Bill — ${amountStr}`;
  const description = [bill.summary || '', '', '---', 'Source text:', sourceText].join('\n');
  return {
    content: title,
    description,
    dueOn: bill.due_date,
  };
}
