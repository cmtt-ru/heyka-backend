#!/bin/bash

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git add . --all
git commit -m "$1"
git checkout $2
git pull origin $2
git merge $BRANCH
git push origin $2
git checkout $BRANCH