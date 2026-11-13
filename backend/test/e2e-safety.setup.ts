import { appendFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { expect } from 'vitest';
import {
  assertDisposableTestEnvironment,
  assertTestDatabaseTarget,
} from './test-database.js';
import { verifyTestDatabaseOwner } from './test-database-owner.js';

Object.assign(process.env, {
  FIREBASE_PROJECT_ID: '',
  FIREBASE_CLIENT_EMAIL: '',
  FIREBASE_PRIVATE_KEY: '',
  NOTIFICATIONS_ENABLED: 'false',
  GMAIL_USER: '',
  BREVO_API_KEY: '',
  VNPAY_TMN_CODE: '',
  VNPAY_HASH_SECRET: '',
});
const expected = assertDisposableTestEnvironment(process.env);
verifyTestDatabaseOwner(process.env, expected);
const { MongoClient } = mongoose.mongo;
const db = MongoClient.prototype.db;
MongoClient.prototype.db = function (name, options) {
  assertTestDatabaseTarget(name ?? this.options.dbName);
  return db.call(this, name, options);
};
const connect = MongoClient.prototype.connect;
MongoClient.prototype.connect = function () {
  const hosts = this.options.hosts;
  const database = this.options.dbName;
  assertTestDatabaseTarget(database);
  if (
    !hosts?.length ||
    hosts.some(
      (host) =>
        host.host !== expected.hostname || String(host.port) !== expected.port,
    )
  )
    throw new Error(
      'Blocked MongoDB connection outside the verified disposable server',
    );
  if (process.env.HMS_TEST_AUDIT)
    appendFileSync(
      process.env.HMS_TEST_AUDIT,
      JSON.stringify({
        file: expect.getState().testPath,
        host: expected.hostname,
        port: expected.port,
        database,
        owner:
          process.env.HMS_TEST_OWNER_PID ?? process.env.HMS_TEST_SERVICE_ID,
      }) + '\n',
    );
  return connect.call(this);
};
