import assert from 'node:assert/strict';
import mongoose from 'mongoose';

// Disposable test database only. Fixtures are created through UC35 and the real Task API, not seed/model writes.
const uri = process.env.MONGODB_URI;
assert.match(new URL(uri).pathname, /^\/hms_(?:[a-z0-9]+_)*test$/);
await mongoose.connect(uri);
let report;
try {
  const db = mongoose.connection;
  const tasks = db.collection('tasks');
  const reports = db.collection('maintenances');
  const manager = await db.collection('users').findOne({ email: 'manager@hms.local' });
  const ops = await db.collection('users').findOne({ email: 'operations@hms.local' });
  assert.ok(manager && ops);
  assert.equal(await tasks.countDocuments(), 0, 'Seed must not create tasks');
  const base = process.env.UC55_API_URL || 'http://127.0.0.1:3000';
  const headers = actor => ({ 'x-dev-role': actor.role, 'x-dev-user-id': String(actor._id), 'Content-Type': 'application/json' });
  const request = async (path, actor = manager, method = 'GET', body) => {
    const response = await fetch(base + '/api/v1' + path, { method, headers: headers(actor), ...(body ? { body: JSON.stringify(body) } : {}) });
    assert.equal(response.status, method === 'POST' ? 201 : 200);
    return response.json();
  };
  const collections = async () => (await db.db.listCollections({}, { nameOnly: true }).toArray()).map(row => row.name).sort();
  const beforeCollections = await collections();
  const empty = await request('/task-queues/summary');
  assert.deepEqual(empty.counts, { assigned: 0, inProgress: 0, completed: 0, other: 0, total: 0 });
  assert.deepEqual(empty.workload, []);
  assert.deepEqual(empty.facets, { taskTypes: [], priorities: [] });
  assert.deepEqual((await request('/task-queues/tasks')).items, []);
  report = await request('/maintenance/reports', ops, 'POST', { facilityLocation: 'UC55 Compose test', description: 'UC55 live supervision smoke', requiresAction: true });
  assert.equal((await request('/task-queues/summary')).counts.assigned, 1);
  await request(`/tasks/${report.taskId}/progress`, ops, 'PATCH', { status: 'IN_PROGRESS' });
  assert.equal((await request('/task-queues/summary')).counts.inProgress, 1);
  await request(`/tasks/${report.taskId}/progress`, ops, 'PATCH', { status: 'COMPLETED', workResult: 'UC55 smoke completed through TasksService' });
  const beforeReads = JSON.stringify(await tasks.find().sort({ _id: 1 }).toArray());
  const summary = await request('/task-queues/summary');
  assert.deepEqual(summary.counts, { assigned: 0, inProgress: 0, completed: 1, other: 0, total: 1 });
  assert.equal(summary.overdue, 0);
  assert.deepEqual(summary.facets.priorities, ['NORMAL']);
  const page = await request('/task-queues/tasks?status=COMPLETED');
  assert.equal(page.total, 1);
  const detail = await request(`/task-queues/tasks/${report.taskId}`);
  assert.equal(detail.workResult, 'UC55 smoke completed through TasksService');
  assert.equal(detail.sourceSummary.description, 'UC55 live supervision smoke');
  assert.deepEqual(Object.keys(detail.assignee).sort(), ['fullName', 'id', 'role']);
  const badSort = await fetch(base + '/api/v1/task-queues/tasks?sortBy=priority', { headers: headers(manager) });
  assert.equal(badSort.status, 400);
  const swagger = await (await fetch(base + '/api/docs-json')).json();
  for (const path of ['/summary', '/tasks', '/tasks/{id}']) assert.ok(swagger.paths['/api/v1/task-queues' + path].get);
  assert.equal(JSON.stringify(await tasks.find().sort({ _id: 1 }).toArray()), beforeReads);
  assert.deepEqual(await collections(), beforeCollections);
  const raw = await tasks.findOne({ _id: new mongoose.Types.ObjectId(report.taskId) });
  for (const field of ['counts', 'overdue', 'workload', 'sortNull']) assert.ok(!(field in raw));
  console.log('UC55 Compose smoke passed: no task seed, live lifecycle counts, exact priority facets, Swagger, read-only snapshots and no new collection/counters');
  // Only the fixture owned by this script is removed; never clear another module's collection.
  await tasks.deleteOne({ _id: new mongoose.Types.ObjectId(report.taskId) });
  await reports.deleteOne({ _id: new mongoose.Types.ObjectId(report.reportId) });
} finally {
  await mongoose.disconnect();
}
