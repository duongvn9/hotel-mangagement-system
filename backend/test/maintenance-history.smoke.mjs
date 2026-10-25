import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import mongoose from 'mongoose';

// Explicit smoke helper, never imported by production. Only a disposable test database.
const uri = process.env.MONGODB_URI;
assert.match(new URL(uri).pathname, /^\/hms_(?:[a-z0-9]+_)*test$/);
await mongoose.connect(uri);
try {
  const reports = mongoose.connection.collection('maintenances');
  const users = mongoose.connection.collection('users');
  const actor = await users.findOne({ email: 'operations@hms.local' });
  assert.ok(actor);
  const scope = { reportedBy: actor._id };
  const snapshotPath = process.env.UC36_SNAPSHOT || '/tmp/uc36-maintenance-before.json';
  if (process.argv[2] === 'snapshot') {
    assert.equal(await reports.countDocuments(scope), 3);
    const row = await reports.findOne(scope);
    await reports.updateOne({ _id: row._id }, { $set: { description: 'UC36 edited seed observation', updatedAt: new Date('2026-10-25T00:00:00Z') }, $inc: { __v: 1 } });
    await writeFile(snapshotPath, JSON.stringify(await reports.find(scope).sort({ _id: 1 }).toArray()));
    console.log('UC36 first seed: three NO_ACTION observations; edited snapshot recorded');
  } else {
    assert.equal(JSON.stringify(await reports.find(scope).sort({ _id: 1 }).toArray()), await readFile(snapshotPath, 'utf8'));
    const base = process.env.UC36_API_URL || 'http://127.0.0.1:3000';
    const headers = { 'x-dev-role': 'OPERATIONS_STAFF', 'x-dev-user-id': String(actor._id) };
    const get = async path => {
      const response = await fetch(base + path, { headers });
      assert.equal(response.status, 200);
      return response.json();
    };
    const page = await get('/api/v1/maintenance/history?status=NO_ACTION');
    assert.equal(page.total, 3);
    assert.ok(page.items.every(row => row.status === 'NO_ACTION' && !row.requiresAction));
    const row = await get(`/api/v1/maintenance/history/${page.items[0].id}`);
    assert.equal(row.task, null);
    assert.deepEqual(Object.keys(row.reportedBy).sort(), ['fullName', 'id']);
    const doc = await get('/api/docs-json');
    assert.ok(doc.paths['/api/v1/maintenance/history'].get);
    assert.ok(doc.paths['/api/v1/maintenance/history/{id}'].get);
    assert.equal(JSON.stringify(await reports.find(scope).sort({ _id: 1 }).toArray()), await readFile(snapshotPath, 'utf8'));
    console.log('UC36 smoke passed: second seed preserves data/timestamps/version; real list/detail and Swagger are read-only');
  }
} finally {
  await mongoose.disconnect();
}
