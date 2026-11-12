import mongoose from 'mongoose';

mongoose.mongo.MongoClient.prototype.connect = function () {
  throw new Error(
    'Database connections are forbidden in unit tests; use the guarded E2E configuration',
  );
};
