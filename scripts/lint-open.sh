#!/bin/sh

# Run eslint, extract file names, convert to relative paths, and directly open them in Cursor
cmd=$(npx eslint . \
    | grep -E '^[^ ]+\.js|^[^ ]+\.ts' \
    | awk '{print $1}' \
    | sort \
    | uniq \
    | sed "s|$PWD/||" \
    | xargs echo cursor)

if [ "$cmd" != "cursor" ]; then
    eval "$cmd"
else
    echo "No files to open."
fi 