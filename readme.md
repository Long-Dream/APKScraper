# APK 分析自动化程序

## 简介

本程序可以自动地爬取 apk 文件, 并进行分析, 并将数据保存到数据库之中

## 前提
运行此自动化程序的电脑需要安装有以下内容

* jdk
* nodeJs
* npm
* mongodb
* [分析程序网页端服务器文件](https://github.com/Long-Dream/AndroidSDK)

## 构建方法

1. 将项目克隆到本地
2. 将网页端服务器的`newSoot`文件夹拷贝到根目录下

## 使用方法
1. 终端运行 `mongod` 以启动服务器
2. 在 ./doSootAnalyse/ 目录下运行 `node ../index.js`
