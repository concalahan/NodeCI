const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');
const keys = require('../config/keys');

// const redisUrl = 'redis://127.0.0.1:6379';
const client = redis.createClient(keys.redisUrl);
// client.get = util.promisify(client.get);
client.hget = util.promisify(client.hget);

const exec = mongoose.Query.prototype.exec;

// add custom function, add options: expect top-level hash key
mongoose.Query.prototype.cache = function(options = {}) {
  // 'this' is query instance
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || ''); // if pass the key, ensure it is string

  return this;
};

// overwrite the query in mongoose
mongoose.Query.prototype.exec = async function() {
  // if not .cache(), call the query
  if(!this.useCache) {
    return exec.apply(this, arguments);
  }

  // can not do on this.getQuery here because it will change
  // should make a copy; must Stringify when working with Redis
  const key = JSON.stringify(Object.assign({}, this.getQuery(), {
    collection: this.mongooseCollection.name
  }));

  // See if we have a value for 'key' in redis
  // const cacheValue = await client.get(key);
  const cacheValue = await client.hget(this.hashKey, key);

  // if we do, return that
  if(cacheValue){
    // before, convert the JSON to mongoose document
    // -> using this.model; this is the query itself

    // const doc = new this.model(JSON.parse(cacheValue));
    // the line above expect 1 object
    const doc = JSON.parse(cacheValue);

    return Array.isArray(doc) ? doc.map(d => new this.model(d)) : new this.model(doc);
  }

  // Otherwise, issue the query and store the result in redis

  // call the original function; expire after 10 second
  const result = await exec.apply(this, arguments, 'EX', 10);

  // client.set(key, JSON.stringify(result));
  client.hset(this.hashKey, key, JSON.stringify(result));

  return result;
}

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  }
}
