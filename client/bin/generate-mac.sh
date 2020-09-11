#!/bin/bash

openssl genrsa -out ./localhost.key 2048
openssl req -new -x509 -key $PWD/localhost.key -out ./localhost.crt -days 3650 -subj /CN=localhost
security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain ./localhost.crt
printf "Ok"
