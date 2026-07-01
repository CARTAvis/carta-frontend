#!/bin/bash
info=`git log -1 --oneline | sed 's/\"//g'`
echo "const INFO = {logMessage: \"$info\"}; export default INFO;" > src/static/gitInfo.ts