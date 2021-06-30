const hash = require('ray-hash');
const fs = require('ray-fs');
const path = require('path');
// Methods (goes in mentioned modules later)

function ffShard(frontFacingDir, item) { // For Front-Facing shard URI
    return path.join(frontFacingDir, item);
}

function getShardsInfo(shards, frontFacingDir) {
  const allShardsInfo = [];
  for (const shard of shards) {
    const shardURI = ffShard(frontFacingDir, shard);
    const fileHash = hash.getHashOfFile(shardURI).value;
    allShardsInfo.push({shardName: shard, shardHash: fileHash});
  }
  return allShardsInfo;
}

function startServer(rayServeObj, shardsInfoArr, sentFileName) { 
  rayServeObj
    .serveJSON("/", {serverName: "slice-net",
                     fileName: sentFileName,
                     shards: shardsInfoArr})
    .listen();
}


module.exports = {
  logIPV4: function (rayServeObj) {
    rayServeObj.getIPV4((err, add, fam)=> { console.log(`The sender IPV4 is ${add}`) });
  }, 
  moveShardsToPublic: function(shards, frontFacingDir) { // Public here means any front-facing aka statically served directory
    for (const shard of shards) {
      const newFileURI = ffShard(frontFacingDir, shard);
      fs.mv(shard, newFileURI);
    }
  },
  serveShards: function(serveObj, shardsPublicDir, shards, fileName) {
    serveObj.static(shardsPublicDir);
    const shardsInfo = getShardsInfo(shards, shardsPublicDir);
    startServer(serveObj, shardsInfo, fileName);
  }
}

