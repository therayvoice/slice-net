#!/usr/bin/env node

const flags = require('ray-flags');
const path = require('path');
const serve = require('ray-serve');
const fs = Object.assign({}, require('ray-fs'));
const hash = Object.assign({}, require('ray-hash'));
const { logIPV4, serveShards, initDownloadSession,
	pulverizeFile, mergeWhenReadyThenExit, removeShards,
	getSucessfullyDownloadedShards, logDownloadProgress } = require('./built-in-methods.js'); 
const fetch = require('node-fetch');

// Parsing and Utilizing Arguments Vector
serve.port = +flags.p || 4321;
const downloader = flags.d || false;
const uploader = flags.u || false;
//const bouncer = flags.b || false; // Bouncing signals
const file = flags.f;
const ipAddr = flags.ip || "localhost";
const shardSize = flags.s || 1000000;
const noMerge = flags.M || false; // avoide merging of shards (under development)
const noShards = flags.S || false; // delete shards after downloading is complete or sending is cancled (under development)
const filesDir = flags.D || ""; // change directory where shards are stored

/* // To be used later
for (let eventType of ['exit', 'SIGINT', 'SIGUSR1', 'SIGUSR2', 'uncaughtException', 'SIGTERM']) {
  process.on(eventType, ()=>{
    if (noShards) removeShards();
  }
}*/

// Constants
const sliceNetDir = path.join(filesDir, "slice-net-files");
const uploadsDir = path.join(sliceNetDir, "sent-files");
const shardsDir = path.join(uploadsDir, `${file} shards`);

// Main Method
if (uploader) {
  console.log("Starting Server for sending:", file);
  logIPV4(serve);
  fs.initDirs(sliceNetDir, uploadsDir);
  //here: add code here to check if files are already sharded, don't shard them
  if (!fs.exists(shardsDir).value) {
    console.log(`Sharding file: ${file}`);
    (async function() {
      let shardNames = await pulverizeFile(file, shardSize, shardsDir, ()=>{ console.log("Sharding Sucessful!") })
      serveShards(serve, shardsDir, shardNames, file);
    })();
  } else {
    console.log(`Shards of ${file} already exist on the system!`);
    const shardNames = fs.cd(shardsDir).lsFile().value;
    serveShards(serve, shardsDir, shardNames, file);
  }

} else if (downloader) {
  console.log("Starting Client for recieveing:");

  const downloadsDir = path.join(sliceNetDir, "recieved-files"); // use later to keep shards one they are all downloaded
  const sendersURL = `http://${ipAddr}:${serve.port}`;
  fs.initDirs(sliceNetDir, downloadsDir); // use later to keep shards when all are downloaded

  (async function() {
    let response = await fetch(sendersURL);
    let json = await response.json();
    if (fs.exists(json.fileName).value) {console.error(`A file named ${json.fileName} already exists!`); process.exit();}
    const shardNamePrefix = `${json.fileName}.sf-part`;
    const totalShardsCount = json.shards.length;
    
    let sucessfullyDownloadedShards = getSucessfullyDownloadedShards(shardNamePrefix); 

    const downloadBar = setInterval(()=>{
      sucessfullyDownloadedShards = getSucessfullyDownloadedShards(shardNamePrefix); 
      logDownloadProgress(sucessfullyDownloadedShards.length, totalShardsCount);
      if (sucessfullyDownloadedShards.length === totalShardsCount) {
        if (!noMerge) mergeWhenReadyThenExit(sucessfullyDownloadedShards, json.fileName);
	else if (noMerge) process.exit();
      }
    },1000);

    for (let shardData of json.shards) {
      sucessfullyDownloadedShards = getSucessfullyDownloadedShards(shardNamePrefix); 
      if (!sucessfullyDownloadedShards.includes(shardData.shardName)) {
	console.log("downloading file", shardData.shardName);
        let res = await fetch(`${sendersURL}/${shardData.shardName}`);
        fs.stream(res.body, shardData.shardName);
      }
    }
  })();

} else {
  console.log("No Upload (-u) or Download (-d) flag given!");
  process.exit();
}

