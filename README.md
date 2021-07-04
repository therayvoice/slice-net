# Slice
A cross-platform CLI tool for transfering large files from one pc to another over slow and unstable networks by breaking the files down into very small parts.

(Some functions are still under Development!)

#Installation
To install using NPM
```
npm i -g slice-net
```

# Example Usage

On the PC from which you want to send the file:
```
slice-net -u -f YourFile.xyz
```
This will also show your hostname, for example 192.162.1.112.

On the PC to which your are sending:
```
slice-net -d -ip 192.162.1.112
```

If a download is discontinued it starts from the last shard it was downloading.

There will be a "sliceFiles" directory which will have all the individual shards, to delete all of these shards upon sucessful download pass "-S" flag.
```
slice-net download 192.162.1.112 -S
```

Similarly, to avoid merging shards use "-M".
```
slice-net -d -ip 192.162.1.112 -M
```

To change the used directroy use the -D flag, for example:-
```
slice-net -d -ip 192.162.1.112 -D ./newDownloads
```

# LICENSE
MIT License

Copyright (c) 2021 Ray Voice

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

