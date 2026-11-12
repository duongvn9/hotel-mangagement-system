import mongoose from 'mongoose';
import { admitSmoke } from './smoke-ownership.mjs';

const { uri } = admitSmoke();
const expected = new URL(uri);
const connect = mongoose.mongo.MongoClient.prototype.connect;
mongoose.mongo.MongoClient.prototype.connect = function () {
  if (
    this.options.dbName !== expected.pathname.slice(1) ||
    this.options.hosts.length !== 1 ||
    this.options.hosts[0].host !== expected.hostname ||
    String(this.options.hosts[0].port) !== expected.port
  )
    throw new Error('Seed connection does not match the owned smoke server');
  return connect.call(this);
};
