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
const generalLogFile = path.join("slice-net_logs.txt");
const thirdArgumentVector = process.argv[4]; // supposed to in 1/10 an MB, 10 means 1mb
let shardSize = 1000000;
const latencyTimeout = 8000; // unused, remove this
const diskToSoftwareLatency = 1000;
let startMerging = false;
let mergingFailed = false;

function hardLog(log) {
//  fs.appendFileSync(generalLogFile, `${log}\n`);
  shadowLog(log);
  console.log(log);
}

function shadowLog(logData) {
  const freshDate = new Date();
  fs.appendFileSync(generalLogFile, `${logData}\n                                  --${freshDate.toISOString()}\n`);
}

hardLog(chalk.bgBlack.white.bold(`New session started`));
hardLog(`User __dirname was: ${chalk.bold.bgBlue.yellow(__dirname)}`);
hardLog(`User currentUserDirectory was: ${chalk.bold.bgYellow.blue(currentUserDirectory)}`)


if (thirdArgumentVector == "noMerge" || thirdArgumentVector == "noShards" || thirdArgumentVector === undefined ) {
  if (thirdArgumentVector === undefined ) {
	  /*
    const generalLog1 = "Slice-net will download the provided file in sharded form and unshard them, then leave the shards for later use.";
    fs.writeSync(generalLogFile,  generalLog1);
    console.log("Slice-net will download the provided file in sharded form and unshard them, then leave the shards for later use.");
    */
    hardLog(chalk.bgBlack.white("Slice-net will download the provided file in sharded form and unshard them, then leave the shards for later use."));
  } else {
    //old: console.log(`${thirdArgumentVector} will take effect after download`);
    hardLog(chalk.bgBlack.red(`${thirdArgumentVector} will take effect after download`)); //new
  }
} else if (+thirdArgumentVector < 50) {
  shardSize = +thirdArgumentVector * 100000;
} else {
  //old: console.log(`${thirdArgumentVector} is not a valid argument`);
  hardLog(chalk.bgBlack.red.bold(`${thirdArgumentVector} is not a valid argument`)); //new
  process.exit();
}


//console.log(chalk.red(__dirname));
//console.log(chalk.yellow(currentUserDirectory))

if (downloadOrUpload == "upload") {
  hardLog(chalk.bgRed.black.bold(`Attempted to start server!`));
  // example: slice upload fileName.mp4

  splitFile.splitFileBySize(`${currentUserDirectory}/${currentFileOrIP }`, shardSize)
    .then((names) => {

      hardLog(chalk.bgYellow.green.bold(`The shards are split into the folloing files aka "names":- \n`));
      hardLog(JSON.stringify(names));

      app.get('/', (req, res) => {
        let token = {
	  fileName:currentFileOrIP,
	  shardCount:names.length,
	  shardNames:names
	}
	hardLog(chalk.bgYellow.cyan.bold(`The "token" sent was the following:-`));
	hardLog(JSON.stringify(token));
        res.send(token);
        //res.send(`{"fileName":"${currentFileOrIP}", "shardCount":${names.length}}`);
      });

// serving all sharded parts of the original file
      for (i in names) {
	hardLog(chalk.bgCyan.white.bold(i)); //remove this
	const part = +i + 1;
	hardLog(chalk.bgCyan.black.inverse(part)); //remove this
        app.get(`/file${part}`, (req, res) => {
	  //const partURL = getShardURL(currentFileOrIP, getShardPrefix(names.length, part), part);
	  const partURL = `${currentUserDirectory}/${currentFileOrIP}.sf-part${getShardPrefix(names.length, part)}${part}`;
          //res.sendFile(`${currentUserDirectory}/${currentFileOrIP}.sf-part${part}`); // get over here // this works perfectly with less than 10 parts
          hardLog(chalk.bgBlue("URL sent is: ") + partURL);
          res.sendFile(partURL); // get over here
        });
      }

      app.listen(port, () => {

        dns.lookup(os.hostname(), (err, add, fam) => {
          hardLog(chalk.bgBlack.white.bold(`Server listening at `) + chalk.bgBlack.cyan.bold(`http://${add}:${port}`));
        });

      })

    })
    .catch((err) => {
      hardLog(`Error caught by splitFileBySize \n Error: ${err}`);
    });

} else if (downloadOrUpload == "download") {

  let downloadedFileShards;
  //wire code to get a valid IP address or web-url
  // example: slice download 192.168.1.112 as argumentVector

  // creating downloads folder named sliceFiles if not created already
  if (!fs.existsSync(`${currentUserDirectory}/${downloadFolder}`)) {
    fs.mkdirSync(`${currentUserDirectory}/${downloadFolder}`);
  }

  fetch(`http://${currentFileOrIP}:${port}`)
    .then(res => res.json())
    .then(json => {
      
      const logFileURL = path.join(currentUserDirectory, downloadFolder, `${ json.fileName }-logs.json`);
      
      // if log file exists then check the last shard downloaded and assign it to downloadedFileShards, else make an empty log file.
      if (fs.existsSync(logFileURL)) {
        const data = fs.readFileSync(logFileURL, {encoding:'utf8', flag:'r'});
	downloadedFileShards = data.split("--")[1];
        hardLog(`Last downloaded shard is ${downloadedFileShards}`);
      } else {
	fs.writeFileSync(logFileURL, `file --none-- downloaded sucessfylly!\n`);
	downloadedFileShards = 1;
        hardLog("No shards were downloaded previously, an empty log file created!");
      }
      
      // Download all shards, starting form the last shard downloaded just in case it was not downloaded properly and saved as an anachronism
      for (let i = downloadedFileShards; i <= json.shardCount; i++) {
	const fileNameToDownloadAs = getShardURL(json.fileName, getShardPrefix(json.shardCount, i), i);
        //console.log(chalk.yellow(`Downloading file #${i} as ${fileNameToDownloadAs}`));
	      // get over here
        //getFile(`http://${currentFileOrIP}:${port}/file${i}`, `${currentUserDirectory}/${downloadFolder}/${json.fileName}.sf-part${i}`);
        getFile(`http://${currentFileOrIP}:${port}/file${i}`, fileNameToDownloadAs);
        fs.writeFileSync(logFileURL, `file --${i}-- downloaded sucessfully!\n`); 
      }

    downloadMissingShards(path.basename(json.fileName), json.shardCount, json.fileName);

    // check logs to see if all shards are downloaded, if yes then merge them into a single file
    const logFileContent = fs.readFileSync(logFileURL, "utf8");

    if (logFileContent.split("--"[1] == json.shardCount)) {
      if ( thirdArgumentVector == "noMerge" ) {
        hardLog("Shards are left Unmerged");
      } else {

	// will use a Promise later, first need to see the interval first hand; also add noShards code here and remove it from where it is, it dosent need a latency
	let mergingInterval = setInterval(() =>{
	  hardLog("Waiting for all shards to download...");
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
  hardLog(`${downloadOrUpload} is not a valid command`);
  process.exit();
}

// console.log("mikiki", currentUserDirectory, "kalkalakl", __dirname, "lll", process.cwd(), "jajaja", process.env.PATH);

function relativeShards(mainFileName, totalShardCount) {
  let shards = [];
  for (let i = 1; i<= totalShardCount; i++) {
    let shardURL = getShardURL(mainFileName, getShardPrefix(totalShardCount, i), i);
    shards.push(shardURL);
  }
  return shards;
}

function getShardPrefix(totalShardCount, partNumber) {
  let shardPrefix;
    if (totalShardCount >= 100) {
      if (partNumber >= 100) {
	shardPrefix = "";
      } else if (partNumber >= 10) {
	shardPrefix = "0";
      } else if (partNumber >= 1) {
	shardPrefix = "00";
      }
    } else if (totalShardCount >=10) {
      if (partNumber >= 10) {
	shardPrefix = "";
      } else if (partNumber >= 1) {
	shardPrefix = "0";
      }
    } else if (totalShardCount >= 1) {
        shardPrefix = "";
    } else {
      hardLog("shard length not valid, or too many shards");
      process.exit();
    }
  return shardPrefix;
}

function getShardURL(currentFileName, prefix, partNumber) {
  const absoluteShardURL = path.join(currentUserDirectory, downloadFolder, `${currentFileName}.sf-part${prefix}${partNumber}`);
  return absoluteShardURL;
}

function mergeShards(fileName, shardCount, logFileForDeleting) {
	// altered this
  const shardsToMerge = relativeShards(fileName, shardCount);
  hardLog(chalk.blue.bgBlack.bold(`Merging the following files:`));
  for (shardCount in shardsToMerge) {
    hardLog(shardsToMerge[shardCount]);
  }

  splitFile.mergeFiles(shardsToMerge, fileName)
    .then(()=>{
      hardLog("merge sucessful!");
      if (thirdArgumentVector == "noShards") {
	 deleteShards(fileName, shardCount, logFileForDeleting);
        }
    })
    .catch((err) => {
      hardLog('Error Merging: '+ err);
    });
}

function deleteShards(fileName, shardCount, logFile) {
  relativeShards(fileName, shardCount).forEach(shard => {
    fs.unlinkSync(shard);
    hardLog("Deleted "+shard);
  })
  
  fs.unlinkSync(logFile);
}

// add a work-in solution for using async fetch instead of sync fetch, right now i'm trying timeIntervals which trigger upon a variable signal like startMerging, etc. Promises don't give a close enough look at what is happening, so they are left for later.
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

function getFile (fileURL, downloadAtPath) {
  downloadSync(fileURL, downloadAtPath);
}

function downloadMissingShards(filename, totalShards, fullFilename) {
  hardLog(chalk.bold.bgYellow.black(`filename: ${filename}`));
  // start work here to check for missing files/parts/shards, then downloading is any missing 

  let shardsPresent = [];
  const downloadedShards = fs.readdirSync(downloadFolder);
  downloadedShards.forEach((itemName, itemIndexInDirectory, listOfAllItemsInDirectory)=>{
    if (itemName.includes(`${filename}.sf-part`)) {
      shardsPresent.push(itemName);
    }
  });

  let shardsPresentInNumbers = shardsPresent.map(x=>+x.split("part").pop());
  let shardsAbsentInNumbers = [];

  for (let i = 1; i <= totalShards; i++) {
    if (!shardsPresentInNumbers.includes(i)) {
      shardsAbsentInNumbers.push(i);
    }
  }
  
  shardsAbsentInNumbers.forEach(shardNumber=>{
    const fileNameToDownloadAs = getShardURL(fullFilename, getShardPrefix(totalShards, shardNumber), shardNumber);
    hardLog(shardNumber);
    getFile(`http://${currentFileOrIP}:${port}/file${shardNumber}`, fileNameToDownloadAs);
  })

  // end work here
  //getFile(`http://${currentFileOrIP}:${port}/file${i}`, fileNameToDownloadAs);
}


function arrayHas(myArray, myElement) {
  myArray.forEach(item => {
    if (item == myElement) {
      return true;
    }
  });
  return false;
}

/*To do*/
// here: In upload, if all the files are sharded don't re-shard them
// Refactor the hell out of this code, it looks like something out of a horror movie
// Add a download Progressbar
