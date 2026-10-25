import assert from 'node:assert/strict';
import mongoose from 'mongoose';
const uri = process.env.MONGODB_URI;
assert.match(new URL(uri).pathname, /^\/hms_(?:[a-z0-9]+_)*test$/);
await mongoose.connect(uri);
try {
 const db = mongoose.connection;
 const manager = await db.collection('users').findOne({ email: 'manager@hms.local' }); assert.ok(manager);
 const base = process.env.OPERATIONAL_API_URL || 'http://127.0.0.1:3000';
 const headers = { 'x-dev-role': 'MANAGER', 'x-dev-user-id': String(manager._id) };
 const names = ['bookings','rooms','serviceorders','issues','maintenances','tasks'];
 const snapshot = async () => JSON.stringify(await Promise.all(names.map(name => db.collection(name).find().sort({ _id:1 }).toArray())));
 const collections = async () => (await db.db.listCollections({}, { nameOnly:true }).toArray()).map(row => row.name).sort();
 const before = await snapshot(), beforeNames = await collections();
 async function get(path) { const response = await fetch(base+'/api/v1'+path,{ headers }); assert.equal(response.status,200); return response.json(); }
 const path = '/reports/operational?from=2026-10-01&to=2026-10-03';
 const d = await get(path);
 for (const name of ['bookings','occupancy','roomsSnapshot','serviceOrders','issues','maintenance','tasks']) assert.equal(d[name].available,true);
 assert.equal(d.period.timezone,'Asia/Ho_Chi_Minh'); assert.equal(d.period.days,3); assert.equal(d.series.length,3);
 const queues = await get('/task-queues/summary');
 assert.deepEqual({ assigned:d.tasks.snapshot.assigned,inProgress:d.tasks.snapshot.inProgress,overdue:d.tasks.snapshot.overdue },{ assigned:queues.counts.assigned,inProgress:queues.counts.inProgress,overdue:queues.overdue });
 assert.equal(d.roomsSnapshot.activeTotal,await db.collection('rooms').countDocuments({ isActive:true }));
 assert.equal(d.occupancy.availableRoomNights,d.roomsSnapshot.activeTotal*3);
 for (const [key,count] of Object.entries({ bookingsCreated:d.bookings.created,checkIns:d.bookings.checkedIn,serviceOrdersCreated:d.serviceOrders.created,issuesReported:d.issues.reported,maintenanceReported:d.maintenance.reported,tasksCompleted:d.tasks.period.completed })) assert.equal(d.series.reduce((sum,row)=>sum+row[key],0),count);
 const other = await get('/reports/operational?from=2025-01-01&to=2025-01-01');
 assert.deepEqual(other.roomsSnapshot.byStatus,d.roomsSnapshot.byStatus); assert.equal(other.tasks.snapshot.assigned,d.tasks.snapshot.assigned);
 await get(path); assert.equal(await snapshot(),before); assert.deepEqual(await collections(),beforeNames);
 const swagger = await (await fetch(base+'/api/docs-json')).json(); assert.ok(swagger.paths['/api/v1/reports/operational'].get); assert.equal(swagger.components.schemas.OperationalReport.properties.occupancy.oneOf.length,2);
 assert.equal((await fetch(base+'/api/v1'+path+'&priority=HIGH',{ headers })).status,400);
 for (const method of ['POST','PUT','PATCH','DELETE']) assert.equal((await fetch(base+'/api/v1'+path,{ headers,method })).status,404);
 console.log('UC57 operational smoke passed: six real sources, live UC55 snapshot, room-night denominator, series reconciliation, Swagger and no writes/new collections');
} finally { await mongoose.disconnect(); }
