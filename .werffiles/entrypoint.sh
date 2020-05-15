#!/usr/bin/env bash

export PUBLIC_POD_IP=`curl -f -s http://169.254.169.254/latest/meta-data/public-ipv4`

if [ -z "RTP_PORT_MIN" ]; then
    echo "ERROR!: you need to setup RTP_PORT_MIN variable"
    exit 1
fi

if [ -z "RTP_PORT_MAX" ]; then
    echo "ERROR!: you need to setup RTP_PORT_MAX variable"
    exit 1
fi


if [ ! -z "$1" ]; then
  exec "$@"
else
  exec /opt/janus/bin/janus --rtp-port-range=${RTP_PORT_MIN}-${RTP_PORT_MAX} --nat-1-1=${PUBLIC_POD_IP}
fi
