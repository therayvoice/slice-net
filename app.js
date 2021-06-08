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
	downloadedFileShards = 0;
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
      mergeShards( json.shardNames, json.fileName);
    }

    });

} else {
  console.log(`${downloadOrUpload} is not a valid command`);
  process.exit();
}

function mergeShards(shards, outputName) {
 splitFile.mergeFiles(shards, outputName)
   .then(()=>{
     console.log("merge sucessful!");
   })
   .catch((err) => {
     console.log('Error Merging: ', err);
   });
}

const getFile = (async (url, path) => {
  const res = await fetch(url);
  const fileStream = fs.createWriteStream(path);
  await new Promise((resolve, reject) => {
    res.body.pipe(fileStream);
    res.body.on("error", reject);
    fileStream.on("finish", resolve);
  });
});

