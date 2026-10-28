#!/bin/zsh
cd -- "${0:A:h}/.."
python3 demo.py claude
printf "\nPress Enter to close."
read -r
