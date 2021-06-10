info=`git log -1 --oneline | sed 's/\"//g'`
echo "const info = {logMessage: \"$info\"}; export default info;" > src/static/gitInfo.ts