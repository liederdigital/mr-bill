// bill.js
// Copy bill text to your clipboard, run this script, get a Basecamp to-do.
//
// The pasted bill text is sent to Anthropic to extract vendor, amount, and
// due date, and is also copied into the resulting Basecamp to-do description.
// Nothing else is transmitted, logged, or stored beyond that.
//
// Usage:
//   1. Select & copy the bill text (renewal page, email, whatever)
//   2. Run: node bill.js
//   3. Review the preview, hit `y` to create the to-do.

import Anthropic from '@anthropic-ai/sdk';
import readline from 'node:readline';
import { execSync } from 'node:child_process';
import { ensureTodoList, createTodo } from './basecamp.js';
import {
  buildTodoFromParsed,
  formatAmount,
  parseModelOutput,
  validateParsedBill,
} from './lib/bill-parse.js';

const { ANTHROPIC_API_KEY } = process.env;

if (!ANTHROPIC_API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY is missing from your environment');
  console.error('  Set it in your shell environment and try again.');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// Use Haiku 4.5 — fast, cheap, plenty smart for structured extraction.
// Cost is a small fraction of a cent per bill.
const MODEL = 'claude-haiku-4-5-20251001';

const EXTRACTION_PROMPT = `You are a bill/invoice parser. Extract structured information from the text below.

Output ONLY a JSON object with these fields. No preamble, no markdown, no code fences:
{
  "vendor": string or null,      // the company/service being paid
  "amount": number or null,      // payment amount as a decimal, no currency symbol
  "currency": string,            // currency code like "USD" or "EUR", default "USD"
  "due_date": string or null,    // next payment/renewal date in YYYY-MM-DD format
  "summary": string              // short one-sentence description
}

Rules:
- Extract only what is explicitly stated. Do NOT guess or invent dates or amounts.
- If multiple dates are mentioned, pick the NEXT due/renewal/payment date (future-facing).
- Amount should be the actual payment amount, not subtotals or line items.
- Vendor is the company charging, never the customer.
- If a field cannot be determined confidently, use null.

Text to parse:
---
TEXT_PLACEHOLDER
---`;

// ---------------------------------------------------------------------------
// Helpers

function readClipboard() {
  try {
    return execSync('pbpaste', { encoding: 'utf8' }).trim();
  } catch {
    throw new Error(
      'Could not read from clipboard (pbpaste failed). Are you on a Mac?'
    );
  }
}

function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function parseBill(text) {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: EXTRACTION_PROMPT.replace('TEXT_PLACEHOLDER', text),
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) {
    throw new Error('No text response from the model');
  }

  return parseModelOutput(textBlock.text);
}

// ---------------------------------------------------------------------------
// Main

async function main() {
  console.log('→ Reading bill text from clipboard...');
  const text = readClipboard();
  if (!text) {
    console.error('✗ Clipboard is empty. Copy your bill text first, then run again.');
    process.exit(1);
  }
  console.log(`  Got ${text.length} characters.`);

  console.log('→ Parsing with Claude...');
  let parsed = await parseBill(text);

  // Ask for missing fields interactively so the to-do isn't useless.
  // Prompts cannot by themselves trigger a Basecamp write.
  if (!parsed.vendor) {
    const vendor = await prompt('  No vendor detected. Enter company name (or Enter to skip): ');
    if (vendor) {
      try {
        parsed = validateParsedBill({ ...parsed, vendor });
      } catch (err) {
        console.log(`  (Ignoring vendor — ${err.message})`);
      }
    }
  }

  if (!parsed.due_date) {
    const date = await prompt('  No due date detected. Enter YYYY-MM-DD (or Enter to skip): ');
    if (date) {
      try {
        parsed = validateParsedBill({ ...parsed, due_date: date });
      } catch {
        console.log('  (Ignoring — not a valid YYYY-MM-DD date)');
      }
    }
  }

  // Final validation before preview or any API call.
  parsed = validateParsedBill(parsed);
  const todoFields = buildTodoFromParsed(parsed, text);

  const amountStr = formatAmount(parsed.amount, parsed.currency);
  console.log('');
  console.log('─────────────────────────────────────');
  console.log(`  Vendor:   ${parsed.vendor || '(unknown)'}`);
  console.log(`  Amount:   ${amountStr}`);
  console.log(`  Due:      ${parsed.due_date || '(none)'}`);
  console.log(`  Summary:  ${parsed.summary || '(none)'}`);
  console.log('─────────────────────────────────────');
  console.log('');

  const answer = (await prompt('Create this to-do? (y/n) ')).toLowerCase();
  if (answer !== 'y' && answer !== 'yes') {
    console.log('Cancelled. No to-do created.');
    return;
  }

  console.log('');
  console.log('→ Finding "Bills" list...');
  const listId = await ensureTodoList('Bills');

  console.log('→ Creating to-do...');
  const todo = await createTodo(listId, todoFields);

  console.log('');
  console.log('✓ To-do created!');
  console.log(`  View it: ${todo.app_url}`);
}

main().catch((err) => {
  console.error('');
  console.error('✗ Error:', err.message);
  process.exit(1);
});
