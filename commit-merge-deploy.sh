#!/bin/bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git add . --all
git commit -m "$2"
git checkout $1
git pull origin $1
git merge $BRANCH -m "merge ${$1} with ${BRANCH}"
git push origin $1
git checkout $BRANCH