import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTodoFromParsed,
  formatAmount,
  parseModelOutput,
  validateParsedBill,
} from '../lib/bill-parse.js';

const valid = {
  vendor: 'Acme Insurance',
  amount: 42.5,
  currency: 'USD',
  due_date: '2026-12-01',
  summary: 'Annual renewal',
};

describe('validateParsedBill', () => {
  it('accepts a well-formed payload and drops unknown fields', () => {
    const result = validateParsedBill({ ...valid, extra: 'ignore me', dock: { id: 1 } });
    assert.deepEqual(result, valid);
    assert.equal(result.extra, undefined);
    assert.equal(result.dock, undefined);
  });

  it('defaults currency to USD when missing', () => {
    const { currency, ...rest } = valid;
    const result = validateParsedBill(rest);
    assert.equal(result.currency, 'USD');
  });

  it('normalizes a 3-letter currency to uppercase', () => {
    const result = validateParsedBill({ ...valid, currency: 'eur' });
    assert.equal(result.currency, 'EUR');
  });

  it('allows null vendor, amount, due date, and summary', () => {
    const result = validateParsedBill({
      vendor: null,
      amount: null,
      currency: 'USD',
      due_date: null,
      summary: null,
    });
    assert.equal(result.vendor, null);
    assert.equal(result.amount, null);
    assert.equal(result.due_date, null);
    assert.equal(result.summary, null);
  });

  it('rejects a non-object or array', () => {
    assert.throws(() => validateParsedBill(null), /JSON object/);
    assert.throws(() => validateParsedBill(['vendor']), /JSON object/);
    assert.throws(() => validateParsedBill('{"vendor":"x"}'), /JSON object/);
  });

  it('rejects a non-numeric or non-finite amount', () => {
    assert.throws(() => validateParsedBill({ ...valid, amount: '12.50' }), /finite number/);
    assert.throws(() => validateParsedBill({ ...valid, amount: Number.NaN }), /finite number/);
    assert.throws(() => validateParsedBill({ ...valid, amount: Infinity }), /finite number/);
    assert.throws(() => validateParsedBill({ ...valid, amount: { value: 1 } }), /finite number/);
  });

  it('rejects an amount outside the accepted range', () => {
    assert.throws(() => validateParsedBill({ ...valid, amount: 1e12 }), /accepted range/);
  });

  it('rejects a malformed or impossible date', () => {
    assert.throws(() => validateParsedBill({ ...valid, due_date: '12/01/2026' }), /YYYY-MM-DD/);
    assert.throws(() => validateParsedBill({ ...valid, due_date: '2026-13-01' }), /valid calendar date/);
    assert.throws(() => validateParsedBill({ ...valid, due_date: '2026-02-30' }), /valid calendar date/);
    assert.throws(() => validateParsedBill({ ...valid, due_date: 20261201 }), /YYYY-MM-DD string/);
  });

  it('accepts a real calendar date', () => {
    const result = validateParsedBill({ ...valid, due_date: '2024-02-29' });
    assert.equal(result.due_date, '2024-02-29');
  });

  it('rejects a bad currency code', () => {
    assert.throws(() => validateParsedBill({ ...valid, currency: 'US' }), /currency/);
    assert.throws(() => validateParsedBill({ ...valid, currency: 'USDD' }), /currency/);
    assert.throws(() => validateParsedBill({ ...valid, currency: 'US$' }), /currency/);
  });

  it('rejects a non-string vendor or an oversized field', () => {
    assert.throws(() => validateParsedBill({ ...valid, vendor: { name: 'Acme' } }), /vendor must be a string/);
    assert.throws(
      () => validateParsedBill({ ...valid, vendor: 'A'.repeat(201) }),
      /maximum length/
    );
    assert.throws(
      () => validateParsedBill({ ...valid, summary: 'S'.repeat(2001) }),
      /maximum length/
    );
  });
});

describe('parseModelOutput', () => {
  it('parses a bare JSON object', () => {
    const result = parseModelOutput(JSON.stringify(valid));
    assert.deepEqual(result, valid);
  });

  it('strips markdown code fences', () => {
    const raw = '```json\n' + JSON.stringify(valid) + '\n```';
    const result = parseModelOutput(raw);
    assert.deepEqual(result, valid);
  });

  it('fails safely on invalid JSON without echoing the body', () => {
    assert.throws(() => parseModelOutput('here is your bill: NOT JSON {'), (err) => {
      assert.match(err.message, /Could not parse model response as JSON/);
      assert.doesNotMatch(err.message, /here is your bill/);
      assert.doesNotMatch(err.message, /NOT JSON/);
      return true;
    });
  });

  it('fails safely on empty output', () => {
    assert.throws(() => parseModelOutput('   '), /empty/);
  });

  it('fails safely on JSON that does not meet the schema', () => {
    assert.throws(
      () => parseModelOutput(JSON.stringify({ ...valid, amount: 'twelve' })),
      /finite number/
    );
  });
});

describe('buildTodoFromParsed', () => {
  it('builds a to-do from validated fields and copies source text into the description', () => {
    const source = 'Please pay Acme $42.50 by December 1.';
    const todo = buildTodoFromParsed(valid, source);
    assert.equal(todo.content, 'Acme Insurance — $42.50');
    assert.equal(todo.dueOn, '2026-12-01');
    assert.match(todo.description, /Annual renewal/);
    assert.match(todo.description, /Source text:/);
    assert.match(todo.description, /Please pay Acme/);
  });

  it('re-validates and refuses unexpected model output before a write can be prepared', () => {
    assert.throws(
      () => buildTodoFromParsed({ ...valid, amount: 'not-a-number' }, 'source'),
      /finite number/
    );
    assert.throws(
      () => buildTodoFromParsed({ vendor: { $gt: '' }, amount: 1 }, 'source'),
      /vendor must be a string/
    );
  });

  it('uses a generic title when vendor is missing', () => {
    const todo = buildTodoFromParsed({ ...valid, vendor: null }, 'text');
    assert.equal(todo.content, 'Bill — $42.50');
  });
});

describe('formatAmount', () => {
  it('formats USD and other currencies', () => {
    assert.equal(formatAmount(10, 'USD'), '$10.00');
    assert.equal(formatAmount(10, 'EUR'), 'EUR 10.00');
    assert.equal(formatAmount(null, 'USD'), '(unknown)');
  });
});
