# Slice
A cross-platform tool for transfering large files from one pc to another over slow and unstable networks by breaking the files down into very small parts.

#Installation
To install using NPM
```
npm i -g slice-net
```

# Example Usage

On the PC from which you want to send the file:
```
slice-net upload fileName.mp4
```
This will also show your hostname, for example 192.162.1.112.

On the PC to which your are sending:
```
slice-net download 192.162.1.112
```

If a download is discontinued it starts from the last shard it was downloading.

There will be a "sliceFiles" directory which will have all the individual shards, to delete all of these shards upon sucessful download pass the string "noShards" as the third arguments. for example:-
```
slice-net download 192.162.1.112 noShards
```

Similarly, to avoid merging shards use "noMerge" as the third argument to stop shards from merging after downloads.
```
slice-net download 192.162.1.112 noMarge
```

