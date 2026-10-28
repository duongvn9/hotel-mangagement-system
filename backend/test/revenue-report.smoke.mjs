import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { PaymentTransactionSchema } from '../dist/modules/payments/schemas/payment-transaction.schema.js';
const uri=process.env.MONGODB_URI;
assert.match(new URL(uri).pathname,/^\/hms_(?:[a-z0-9]+_)*test$/);
await mongoose.connect(uri);
const Payment=mongoose.models.PaymentTransaction||mongoose.model('PaymentTransaction',PaymentTransactionSchema);
const owned=[];
try {
 await Payment.init();
 const manager=await mongoose.connection.collection('users').findOne({email:'manager@hms.local'});assert.ok(manager);
 const base=process.env.UC56_API_URL||'http://127.0.0.1:3000';
 const headers={'x-dev-role':'MANAGER','x-dev-user-id':String(manager._id)};
 const url=base+'/api/v1/reports/revenue?from=2026-10-01&to=2026-10-03';
 async function report(){const response=await fetch(url,{headers});assert.equal(response.status,200);return response.json()}
 assert.equal((await report()).totals.successAmount,0);
 const collections=async()=>(await mongoose.connection.db.listCollections({}, {nameOnly:true}).toArray()).map(row=>row.name).sort();const beforeCollections=await collections();
 for(const extra of [{method:'VNPAY',purpose:'DEPOSIT',amount:100001},{method:'CASH',purpose:'FINAL',amount:234567},{status:'FAILED',amount:999999999}]) {
  const row=await Payment.create({booking:new mongoose.Types.ObjectId(),invoice:new mongoose.Types.ObjectId(),transactionRef:randomUUID(),method:'VNPAY',purpose:'DEPOSIT',status:'SUCCESS',amount:100,paidAt:new Date('2026-10-01T17:00:00Z'),createdAt:new Date('2026-10-02T00:00:00Z'),...extra});owned.push(row._id);
 }
 const before=JSON.stringify(await Payment.find({_id:{$in:owned}}).sort({_id:1}).lean());
 const data=await report();assert.equal(data.totals.successAmount,334568);assert.equal(data.totals.successCount,2);assert.equal(data.totals.failedCount,1);assert.equal(data.totals.refunds,null);assert.equal(data.totals.refundsSupported,false);assert.equal(data.totals.netAmount,null);
 for(const rows of [data.byMethod,data.byPurpose,data.series])assert.equal(rows.reduce((sum,row)=>sum+row.successAmount,0),334568);
 assert.deepEqual(data.series.map(row=>row.successAmount),[0,334568,0]);assert.equal(data.period.timezone,'Asia/Ho_Chi_Minh');
 await report();assert.equal(JSON.stringify(await Payment.find({_id:{$in:owned}}).sort({_id:1}).lean()),before);assert.deepEqual(await collections(),beforeCollections);
 const swagger=await(await fetch(base+'/api/docs-json')).json();assert.ok(swagger.paths['/api/v1/reports/revenue'].get);
 assert.equal((await fetch(url+'&method=OTHER',{headers})).status,400);
 assert.equal((await fetch(url,{headers,method:'POST'})).status,404);
 console.log('UC56 revenue smoke passed: recorded payment fixtures, Vietnam buckets, exact integer receipts, no refund representation, aggregate-only Swagger and read-only snapshots');
} finally {
 await Payment.deleteMany({_id:{$in:owned}});
 await mongoose.disconnect();
}