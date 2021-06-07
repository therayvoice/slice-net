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

  //wire code to get a valid IP address
  // example: slice download 192.168.1.112

  // creating downloads folder named sliceFiles if not created already
  if (!fs.existsSync(`${currentUserDirectory}/${downloadFolder}`)) {
    fs.mkdirSync(`${currentUserDirectory}/${downloadFolder}`);
  }

  fetch(`http://${currentFileOrIP}:${port}`)
    .then(res => res.json())
    .then(json => {

	    let continuance = true;
//      if (/* if no files are sent */) {
        for (i in json.shardNames) {
	  const part = +i + 1;

	  if (!fs.existsSync(`${currentUserDirectory}/${downloadFolder}/${json.fileName}.sf-part${part}`)) {
	    if (continuance == true) {
		    // to delete the last file downloaded, which musthave been in complete
	      continuance = false;
              getFile(`http://${currentFileOrIP}:${port}/file${part -1 }`, `${currentUserDirectory}/${downloadFolder}/${json.fileName}.sf-part${part -1}`);
	    }
          
		  getFile(`http://${currentFileOrIP}:${port}/file${part}`, `${currentUserDirectory}/${downloadFolder}/${json.fileName}.sf-part${part}`);

	  }

          fs.writeFile(`${currentUserDirectory}/${downloadFolder}/${json.fileName}-logs.json`, `file --${part}-- downloaded sucessfully!\n`, function (err) {
            if (err) throw err;
            console.log('Saved!');
          }); 
          
        }
//      }
      
  // if all parts are downloaded sucessfully then merge them

  fs.readFile(`${currentUserDirectory}/${downloadFolder}/${json.fileName}-logs.json`, "utf8", function(err, data) {

    let shardNamesInDownloadDirectory = [];
    const mergedFileName = `${currentUserDirectory}/${downloadFolder}/${json.fileName}`;

    for (item of json.shardNames) {
      let itemBreadCrumbs = item.split("/");
      shardNamesInDownloadDirectory.push(itemBreadCrumbs[itemBreadCrumbs.length-1]); 
    }
    console.log(shardNamesInDownloadDirectory);
    console.log(mergedFileName);

    if (data.split("--")[1] == json.shardCount) {
      splitFile.mergeFiles(shardNamesInDownloadDirectory, mergedFileName)
        .then(()=>{
	  console.log("merge sucessful!");
	})
        .catch((err) => {
          console.log('Error: ', err);
        });

    }

  });    

      console.log(json);
    });

} else {
  console.log(`${downloadOrUpload} is not a valid command`);
  process.exit();
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

