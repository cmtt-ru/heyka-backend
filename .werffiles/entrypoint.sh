#!/usr/bin/env bash

export PUBLIC_POD_IP=`curl -f -s http://169.254.169.254/latest/meta-data/public-ipv4`


if [ ! -z "$1" ]; then
  exec "$@"
else
  exec /opt/janus/bin/janus --rtp-port-range={{ pluck .Values.global.env .Values.janus.rtp_port.min | first | default .Values.janus.rtp_port.min._default }}-{{ pluck .Values.global.env .Values.janus.rtp_port.max | first | default .Values.janus.rtp_port.max._default }} --nat-1-1=$(PUBLIC_POD_IP)
fi
