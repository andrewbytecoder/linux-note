#!/bin/sh


# shellcheck disable=SC2046
docker stop $(docker ps -q)
docker rm $(docker ps -aq)


