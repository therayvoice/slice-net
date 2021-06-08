#!/usr/bin/env node

// order of arguments: downloadOrUpload, fileNameOrIpAddress
// if the download is sucessful we have to manually delete files

const express = require('express');
const splitFile = require('split-file');
const fetch = require('node-fetch');
const chalk = require('chalk');
const fs = require('fs');
const dns = require('dns');
const os = require('os');
const path = require('path');

/*
require('dns').lookup(require('os').hostname(), function (err, add, fam) {
  console.log('addr: ' + add);
})
*/

const app = express();
const port = 3210;
const downloadOrUpload = process.argv[2]; // "download" or "upload"
const currentUserDirectory = process.cwd();
const currentFileOrIP = process.argv[3]; // "a file name", "not absolute"
// here: write code for just serving or getting part number
const downloadFolder = "sliceFiles";
const thirdArgumentVector = process.argv[4];
const latencyTimeout = 8000;
const diskToSoftwareLatency = 1000;
let startMerging = false;
let mergingFailed = false;

if (thirdArgumentVector == "noMerge" || thirdArgumentVector == "noShards" || thirdArgumentVector === undefined) {
  if (thirdArgumentVector === undefined) {
    console.log("Slice-net will download the provided file in sharded form and unshard them, then leave the shards for later use.");
  } else {
    console.log(`${thirdArgumentVector} will take effect after download`);
  }
} else {
  console.log(`${thirdArgumentVector} is not a valid argument`);
  process.exit();
}

// console.log(process.argv);
/*
if (process.argv[2] != "download" || process.argv[2] != "upload") {
  console.log(`${process.argv[2]} is not a valid command`);
}
*/
// console.log(typeof(process.argv[3]));

console.log(chalk.red(__dirname));
console.log(chalk.yellow(currentUserDirectory))

if (downloadOrUpload == "upload") {

  // example: slice upload fileName.mp4

  splitFile.splitFileBySize(`${currentUserDirectory}/${currentFileOrIP }`, 1000000)
    .then((names) => {

      console.log(names);

      app.get('/', (req, res) => {
        let token = {
	  fileName:currentFileOrIP,
	  shardCount:names.length,
	  shardNames:names
	}
	console.log(token);
        res.send(token);
        //res.send(`{"fileName":"${currentFileOrIP}", "shardCount":${names.length}}`);
      });

// serving all sharded parts of the original file
      for (i in names) {
	const part = +i + 1;
        app.get(`/file${part}`, (req, res) => {
          res.sendFile(`${currentUserDirectory}/${currentFileOrIP}.sf-part${part}`);
        });
      }

      app.listen(port, () => {

        dns.lookup(os.hostname(), (err, add, fam) => {
          console.log(`Example app listening at http://${add}:${port}`)
        });

      })

    })
    .catch((err) => {
      console.log('Error: ', err);
    });

} else if (downloadOrUpload == "download") {

  let downloadedFileShards;
  //wire code to get a valid IP address
  // example: slice download 192.168.1.112 as argumentVector

  // creating downloads folder named sliceFiles if not created already
  if (!fs.existsSync(`${currentUserDirectory}/${downloadFolder}`)) {
    fs.mkdirSync(`${currentUserDirectory}/${downloadFolder}`);
  }

  fetch(`http://${currentFileOrIP}:${port}`)
    .then(res => res.json())
    .then(json => {
      
      const logFileURL = `${ currentUserDirectory }/${ downloadFolder }/${ json.fileName }-logs.json`;
      
      // if log file exists then check the last shard downloaded and assign it to downloadedFileShards, else make an empty log file.
      if (fs.existsSync(logFileURL)) {
        const data = fs.readFileSync(logFileURL, {encoding:'utf8', flag:'r'});
	downloadedFileShards = data.split("--")[1];
        console.log(`Last downloaded shard is ${downloadedFileShards}`);
      } else {
	fs.writeFileSync(logFileURL, `file --none-- downloaded sucessfylly!\n`);
	downloadedFileShards = 1;
        console.log("No shards were downloaded previously, an empty log file created!");
      }
      
      // Download all shards, starting form the last shard downloaded just in case it wasent downloaded properly
      for (let i = downloadedFileShards; i <= json.shardCount; i++) {
        console.log(`Downloading file #${i}`);
        getFile(`http://${currentFileOrIP}:${port}/file${i}`, `${currentUserDirectory}/${downloadFolder}/${json.fileName}.sf-part${i}`);
        fs.writeFileSync(logFileURL, `file --${i}-- downloaded sucessfully!\n`); 
      }
  
    // check logs to see if all shards are downloaded, if yes then merge them into a single file
    const logFileContent = fs.readFileSync(logFileURL, "utf8");

    if (logFileContent.split("--"[1] == json.shardCount)) {
      if ( thirdArgumentVector == "noMerge" ) {
        console.log("Shards are left Unmerged");
      } else {

	// will use a Promise later, first need to see the interval first hand; also add noShards code here and remove it from where it is, it dosent need a latency
	let mergingInterval = setInterval(() =>{
	  console.log("Waiting for all shards to download...");
	  if (startMerging == true) {
            // maybe this goes second
            mergeShards(json.fileName, json.shardCount, logFileURL);
	    // maybe this goes first
            clearInterval(mergingInterval);
	  }
	}, diskToSoftwareLatency);
        
      }
    }

    });

} else {
  console.log(`${downloadOrUpload} is not a valid command`);
  process.exit();
}

// console.log("mikiki", currentUserDirectory, "kalkalakl", __dirname, "lll", process.cwd(), "jajaja", process.env.PATH);

function relativeShards(mainFileName, totalShardCount) {
  let shards = [];
  for (let i = 1; i<= totalShardCount; i++) {
    let shardURL = path.join(currentUserDirectory, downloadFolder, `${mainFileName}.sf-part${i}`);
    shards.push(shardURL);
  }
  return shards;
}

function mergeShards(fileName, shardCount, logFileForDeleting) {
  splitFile.mergeFiles(relativeShards(fileName, shardCount), fileName)
    .then(()=>{
      console.log("merge sucessful!");
      if (thirdArgumentVector == "noShards") {
	 deleteShards(fileName, shardCount, logFileForDeleting);
        }
    })
    .catch((err) => {
      console.log('Error Merging: ', err);
    });
}

function deleteShards(fileName, shardCount, logFile) {
  relativeShards(fileName, shardCount).forEach(shard => {
    fs.unlinkSync(shard);
    console.log("Deleted "+shard);
  })
  
  fs.unlinkSync(logFile);
}

// add a work-in solution for using async fetch instead of sync fetch, right now i'm trying timeIntervals which trigger upon a variable signal like startMerging, etc. Promises don't give a close enough look at what is happening, so they are left for later.
async function downloadSync(url, filePath){
    return await fetch(url)
    .then(res => {
      const fileStream = fs.createWriteStream(filePath);
      res.body.pipe(fileStream);
      res.body.on("error", ()=>{
	console.log(`file at ${url} download faild!`);
	mergingFailed = true; // let's see if this works
      });
      fileStream.on("finish", ()=>{
	console.log(`file at ${url} downloaded sucessfully!`);
	startMerging = true; // let's see if this works
      });
    })
}

function getFile (fileURL, downloadAtPath) {
  downloadSync(fileURL, downloadAtPath);
}

/*To do*/
// here: In upload, if all the files are sharded don't re-shard them
// Refactor the hell out of this code, it looks like something out of a horror movie
