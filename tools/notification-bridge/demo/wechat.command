#!/bin/zsh
cd -- "${0:A:h}/.."
python3 demo.py wechat
printf "\nPress Enter to close."
read -r
