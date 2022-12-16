#!/bin/bash

sudo su
yum update -y
yum -y groupinstall "Development Tools"
yum -y install gcc openssl-devel bzip2-devel libffi-devel sqlite-devel wget
cd /opt
wget https://www.python.org/ftp/python/3.9.16/Python-3.9.16.tgz
tar xzf Python-3.9.16.tgz
cd Python-3.9.16
./configure --enable-optimizations --enable-loadable-sqlite-extensions
make altinstall
cd ~
mkdir ~/efs
