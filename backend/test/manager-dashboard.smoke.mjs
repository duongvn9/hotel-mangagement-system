import assert from 'node:assert/strict';
import mongoose from 'mongoose';
const uri=process.env.MONGODB_URI;
assert.match(new URL(uri).pathname,/^\/hms_(?:[a-z0-9]+_)*test$/);
await mongoose.connect(uri);
try {
 const db=mongoose.connection;
 const manager=await db.collection('users').findOne({email:'manager@hms.local'});assert.ok(manager);
 const base=process.env.DASHBOARD_API_URL||'http://127.0.0.1:3000';
 const headers={'x-dev-role':'MANAGER','x-dev-user-id':String(manager._id)};
 async function get(path){const response=await fetch(base+'/api/v1'+path,{headers});assert.equal(response.status,200);return response.json()}
 const snapshot=async()=>JSON.stringify(await Promise.all(['tasks','rooms','paymenttransactions'].map(name=>db.collection(name).find().sort({_id:1}).toArray())));
 const collections=async()=>(await db.db.listCollections({}, {nameOnly:true}).toArray()).map(row=>row.name).sort();
 const before=await snapshot(),names=await collections();
 const dashboard=await get('/dashboard/manager');for(const name of ['tasks','rooms','revenue'])assert.equal(dashboard[name].available,true);
 const queues=await get('/task-queues/summary');assert.deepEqual(dashboard.tasks.counts,{assigned:queues.counts.assigned,inProgress:queues.counts.inProgress,completed:queues.counts.completed});assert.equal(dashboard.tasks.overdue,queues.overdue);
 const rooms=await get('/rooms?isActive=true&limit=100');assert.equal(dashboard.rooms.activeTotal,rooms.total);assert.equal(Object.values(dashboard.rooms.byStatus).reduce((a,b)=>a+b,0),rooms.total);assert.deepEqual(Object.keys(dashboard.rooms.byStatus),['AVAILABLE','OCCUPIED','CLEANING','MAINTENANCE']);
 const {from,to,timezone}=dashboard.revenue.period;assert.equal(timezone,'Asia/Ho_Chi_Minh');const revenue=await get('/reports/revenue?from='+from+'&to='+to);assert.equal(dashboard.revenue.successAmount,revenue.totals.successAmount);assert.equal(dashboard.revenue.successCount,revenue.totals.successCount);
 await get('/dashboard/manager');assert.equal(await snapshot(),before);assert.deepEqual(await collections(),names);
 const swagger=await(await fetch(base+'/api/docs-json')).json();assert.ok(swagger.paths['/api/v1/dashboard/manager'].get);
 assert.equal((await fetch(base+'/api/v1/dashboard/manager',{headers,method:'POST'})).status,404);
 assert.equal((await fetch(base+'/api/v1/dashboard/manager')).status,401);
 console.log('Manager dashboard smoke passed: seeded active rooms, reused live queue/revenue summaries, Swagger and repeated GET snapshots without new collections');
} finally {await mongoose.disconnect()}