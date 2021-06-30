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
const downloadsDir = path.join(sliceNetDir, "recieved-files");
const uploadsDir = path.join(sliceNetDir, "sent-files");

// Methods (goes in mentioned modules later)
function logIPV4() {
  serve.getIPV4((err, add, fam)=> { console.log(`The sender IPV4 is ${add}`) });
}


function startServer(shardsInfoArr, sentFileName) { 
  serve
    .serveJSON("/", {serverName: "slice-net",
	             fileName: sentFileName,
	             shards: shardsInfoArr})
    .listen();
}

function moveShardsToPublic(shards, frontFacingDir) { // Public here means any front-facing aka statically served directory
  for (const shard of shards) {
    const newFileURI = path.join(frontFacingDir, shard);
    fs.mv(shard, newFileURI);
  }
}

function getShardsInfo(shards, frontFacingDir) {
  const allShardsInfo = [];
  for (const shard of shards) {
    const fileHash = hash.getHashOfFile(shard).value;
    allShardsInfo.push({shardName: shard, shardHash: fileHash});
  }
  return allShardsInfo;
}



// Main Method
if (uploader) {
  console.log("Starting Server for sending:", file);
  logIPV4();
  fs.initDirs(sliceNetDir, uploadsDir);
  //here: add code here to check if files are already sharded, don't shard them

  splitFile
    .splitFileBySize(file, shardSize)
    .then(names => {
      // Must be done in this order
      const shardsInfo = getShardsInfo(names, uploadsDir);
      moveShardsToPublic(names, uploadsDir);
      serve.static(uploadsDir);
      //const shardsInfo = getShardsInfo(names, uploadsDir);
      startServer(shardsInfo, file);
    });

} else if (downloader) {
  console.log("Starting Client for recieveing:");
  const baseURL = `http://${ipAddr}:${serve.port}`;
  fs.initDirs(sliceNetDir, downloadsDir);

  fetch(baseURL) // fetching the data about shards
    .then(res => res.json())
    .then(json => {
      const infoFile = `${json.fileName}-info.json`;
      const fileInfo = {fileName: json.fileName, downloadedShards: []}; //file info

      fileInfo.recievedFileData = json;
      const downloadBar = setInterval(()=>{
        console.log("Download Completed", Math.floor((fileInfo.downloadedShards.length / json.shards.length)*100), "%");
      },5000);

      if (!fs.exists(infoFile).value) fs.writeJSON(infoFile, fileInfo);
      else if (fs.exists(infoFile).value) fileInfo = fs.readJSON(infoFile).value;

      json.shards.forEach(shardData => {
	if (!fileInfo.downloadedShards.includes(shardData.shardName)) {
       	    fetch(`${baseURL}/${shardData.shardName}`) // fetching the shards
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
  console.log("No Upload or Download command Given!");
  process.exit();
}

/*
// DownloadSync Function
async function downloadSync(url, filePath){
  hardLog(chalk.bgYellow.blue.bold(`Download Starting: `) + `Downloading from ${path.basename(url)} at ` + chalk.blue(`${path.basename(filePath)}`));
    return await fetch(url)
    .then(res => {
      const fileStream = fs.createWriteStream(filePath);
      res.body.pipe(fileStream);
      res.body.on("error", ()=>{
        hardLog(chalk.bgRed.yellow.bold(`Download Faild: `) + `file at ${path.basename(url)} download faild! An anachronism of the file is saved at ` + chalk.red(`${path.basename(filePath)}`));
	mergingFailed = true; // let's see if this works
      });
      fileStream.on("finish", ()=>{
	hardLog(chalk.bgCyan.yellow.bold(`Download Sucessful: `) + `file at ${path.basename(url)} downloaded sucessfully! Saved as ` + chalk.cyan(`${path.basename(filePath)}`));
	startMerging = true; // let's see if this works
      });
    })
}
	  

*/
