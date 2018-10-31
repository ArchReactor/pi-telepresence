#!/bin/bash

#turn off power save to improve performance
sudo iw dev wlan0 set power_save off

#rotate camera since our mount is under the monitor upside down
v4l2-ctl --set-ctrl=rotate=180

cd /home/pi/newbot

(sleep 2 && chromium-browser https://arpibot:8080/?host=yes) &
nodejs server.js
