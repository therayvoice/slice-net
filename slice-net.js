#!/usr/bin/env node

const flags = require('ray-flags');
const path = require('path');
const splitFile = require('split-file');
const serve = require('ray-serve');
const fs = Object.assign({}, require('ray-fs'));
const hash = Object.assign({}, require('ray-hash'));

const fetch = require('node-fetch');

// Parsing and Utilizing Arguments Vector
serve.port = +flags.p || 4321;
const downloader = flags.d || false;
const uploader = flags.u || false;
const file = flags.f;
const ipAddr = flags.ip;
const shardSize = flags.s || 1000000;
const noMerge = flags.M || false;
const noShards = flags.S || false;
const filesDir = flags.d || ""; 

// Constants
const sliceNetDir = path.join(filesDir, "slice-net-files");
const downloadsDir = path.join(sliceNetDir, "recieved-files");
const uploadsDir = path.join(sliceNetDir, "sent-files");

// Methods (goes in mentioned modules later)
function initDir(dir) { // goes in ray-fs
  if (!fs.exists(dir).value) fs.mkdir(dir);
}
function startServer(shardsInfoArr) {
  serve
    .serveJSON("/", {serverName: "slice-net",
	             shards: shardsInfoArr})
    .listen();
}

// Main Method
if (uploader) {
  console.log("Starting Server for sending:", file);
  initDir(sliceNetDir);
  initDir(uploadsDir);
  //here: add code here to check if files are already sharded, don't shard them then

  splitFile
    .splitFileBySize(file, shardSize)
    .then(names => {
      const shardInfo = [];
      names.forEach(name => {
	const fileHash = hash.getHashOfFile(name).value;
        const newFileURI = path.join(uploadsDir, name);
        fs.mv(name, newFileURI);
        shardInfo.push({shardName: name, shardHash: fileHash});
	serve.static(uploadsDir);
      });
      startServer(shardInfo);
    });

} else if (downloader) {

} else {
  console.log("No Upload or Download command Given!");
  process.exit();
}

