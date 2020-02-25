#!/bin/bash
#
# This script is intended as a temporary fix for the missing ">" breadcrumb symbols in the file browser that only occurs when we build the frontend in production mode.
# CARTAvis/carta-frontend issue #698
# It seems to be a sass-loader bug. The problem may eventually go away, but meanwhile this script will fix it. 
# This script will be run automatically at the last step of "npm run build".

if [ "$(uname)" == "Darwin" ]; then

  sed -i '' "s/M10.71 7.29l-4-4a1.003 1.003 0 0-1.42 1.42 NaNl.46 NaNL5.3 NaNC5.11 NaN 5 NaN 5 NaNa1.003 1.003 0 1.71.71 NaN NaNlNaN NaNcNaN NaN NaN NaN NaN NaN NaN NaN NaN NaN NaN NaNz/M10.71 7.29l-4-4a1.003 1.003 0 00-1.42 1.42L8.59 8 5.3 11.29c-.19.18-.3.43-.3.71a1.003 1.003 0 001.71.71l4-4c.18-.18.29-.43.29-.71 0-.28-.11-.53-.29-.71z/w patch.txt" build/static/css/main*.css
  if [ -s patch.txt ]; then
    echo "The production build css file has been patched for the breadcrumbs fix."
  else
    echo "The css file has NOT been patched. Maybe the sass-loader/breadcrumbs problem is gone?"
  fi

fi

if [ "$(uname)" == "Linux" ]; then

  sed -i "s/M10.71 7.29l-4-4a1.003 1.003 0 0-1.42 1.42 NaNl.46 NaNL5.3 NaNC5.11 NaN 5 NaN 5 NaNa1.003 1.003 0 1.71.71 NaN NaNlNaN NaNcNaN NaN NaN NaN NaN NaN NaN NaN NaN NaN NaN NaNz/M10.71 7.29l-4-4a1.003 1.003 0 00-1.42 1.42L8.59 8 5.3 11.29c-.19.18-.3.43-.3.71a1.003 1.003 0 001.71.71l4-4c.18-.18.29-.43.29-.71 0-.28-.11-.53-.29-.71z/w patch.txt" build/static/css/main*.css
  if [ -s patch.txt ]; then
    echo "The production build css file has been patched for the breadcrumbs fix."
  else
    echo "The css file has NOT been patched. Maybe the sass-loader/breadcrumbs problem is gone?"
  fi

fi

rm patch.txt
