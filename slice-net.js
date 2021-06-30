#!/usr/bin/env node

const flags = require('ray-flags');
const path = require('path');
const splitFile = require('split-file');
const serve = require('ray-serve');
const fs = Object.assign({}, require('ray-fs'));
const hash = Object.assign({}, require('ray-hash'));
const { logIPV4, moveShardsToPublic, serveShards, initDownloadSession } = require('./built-in-methods.min.js'); 
const fetch = require('node-fetch');


// Parsing and Utilizing Arguments Vector
serve.port = +flags.p || 4321;
const downloader = flags.d || false;
const uploader = flags.u || false;
//const bouncer = flags.b || false; // Bouncing signals
const file = flags.f;
const ipAddr = flags.ip || "localhost";
const shardSize = flags.s || 1000000;
const noMerge = flags.M || false;
const noShards = flags.S || false;
const filesDir = flags.D || ""; 
const showIPV4 = flags.I; 

// Constants
const sliceNetDir = path.join(filesDir, "slice-net-files");

// Main Method
if (uploader) {
  console.log("Starting Server for sending:", file);
  const uploadsDir = path.join(sliceNetDir, "sent-files");
  const shardsDir = path.join(uploadsDir, `${file} shards`);
  logIPV4(serve);
  fs.initDirs(sliceNetDir, uploadsDir);
  //here: add code here to check if files are already sharded, don't shard them
  if (!fs.exists(shardsDir).value) {
    console.log(`Sharding file: ${file}`);
    splitFile
      .splitFileBySize(file, shardSize)
      .then(names => {
        fs.initDir(shardsDir);
        moveShardsToPublic(names, shardsDir);
	serveShards(serve, shardsDir, names, file);
      });
  } else {
    console.log(`Shards of ${file} already exist on the system!`);
    const shardNames = fs.cd(shardsDir).lsFile().value;
    serveShards(serve, shardsDir, shardNames, file);
  }

} else if (downloader) {
  console.log("Starting Client for recieveing:");

  const downloadsDir = path.join(sliceNetDir, "recieved-files");
  const sendersURL = `http://${ipAddr}:${serve.port}`;
  fs.initDirs(sliceNetDir, downloadsDir);

  fetch(sendersURL) // fetching the shard's info form sender's root
    .then(res => res.json())
    .then(json => {
      const infoFile = `${json.fileName}-info.json`;
      const fileInfo = {downloadedShards: [], recievedFileData: json };
      initDownloadSession(infoFile, fileInfo);
    

      const downloadBar = setInterval(()=>{
        console.log("Download Completed", Math.floor((fileInfo.downloadedShards.length / json.shards.length)*100), "%");
      },5000);


      json.shards.forEach(shardData => {
	if (!fileInfo.downloadedShards.includes(shardData.shardName)) {
       	    fetch(`${sendersURL}/${shardData.shardName}`) // fetching the shards
              .then(res => {
                fs.stream(res.body, shardData.shardName, () => {},
                  () => { // file download sucess callback
                    fileInfo.downloadedShards.push(shardData.shardName);
	            fs.writeJSON(infoFile, fileInfo); // updating fileInfo
	            const shards = json.shards.map(shard => shard.shardName);
                    const shardHashes = json.shards.map(shard => shard.shardHash);
                  
                    console.log("Files downloaded", fileInfo.downloadedShards.length, "out of", json.shards.length);
                    if (fileInfo.downloadedShards.length == json.shards.length) {
                      splitFile.mergeFiles(shards, json.fileName)
                        .then(() => {
	                  console.log("Files Merged!");
			  clearInterval(downloadBar);
		          shards.forEach(shard => {
		            //fs.mv(shard, downloadDir);
			    if (noShards) fs.rm(shard);
		          });
	                })
	              .catch((err)=>{
	                console.log("Unsucessful Merge Error:", err);
	              });
		    }
	        });
	      });
          console.log(shardData.shardName);
	}
      });
    });
  
} else {
  console.log("No Upload (-u) or Download (-d) flag given!");
  process.exit();
}

