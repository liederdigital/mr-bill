// test-todo.js
// Plumbing check. Creates one hardcoded to-do in your Bills project
// to prove the API auth + write path works. Run with: node test-todo.js
//
// This talks to the real Basecamp API and will create a to-do. It is not
// part of `npm test`.

import { ensureTodoList, createTodo } from './basecamp.js';

function isoDaysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

async function main() {
  console.log('→ Finding (or creating) the "Bills" to-do list...');
  const listId = await ensureTodoList('Bills');
  console.log(`  Using list ID ${listId}`);

  const dueOn = isoDaysFromNow(30);

  console.log('→ Creating test to-do...');
  const todo = await createTodo(listId, {
    content: 'Test: Mr. Bill plumbing check',
    description: `Created by test-todo.js at ${new Date().toISOString()}. Safe to delete.`,
    dueOn,
  });

  console.log('');
  console.log('✓ To-do created!');
  console.log(`  Title:    ${todo.content}`);
  console.log(`  Due:      ${todo.due_on}`);
  console.log(`  View it:  ${todo.app_url}`);
  console.log('');
  console.log('If you can see this to-do in Basecamp, the API plumbing works.');
  console.log('You can delete it whenever you want.');
}

main().catch((err) => {
  console.error('');
  console.error('✗ Error:', err.message);
  process.exit(1);
});
