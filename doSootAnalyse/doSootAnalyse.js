"use strict";

var fs         = require('fs');
var cp         = require('child_process');

// doSootAnalyse("../apkDownload/0e5752b59859c62a40ec7b0d5d045714.apk", "../newSoot/newSoot.jar", "../result/", ["analysis_api", "analysis_order", "analysis_permission", "analysis_sdk"], function(){})



/**
 * 进行分析, 并返回分析结果
 * @param  {path}   path       apk 文件的路径
 * @param  {path}   javaPath   要运行的 java 文件的路径
 * @param  {path}   resultPath 结果文本文档的路径
 * @param  {array}   resultArr  要读取的结果文档的文件名数组
 * @param  {Function} callback   回调函数
 *                               参数 1 err 错误处理
 *                               参数 2 result 返回的结果对象
 */
function doSootAnalyse(path, javaPath, resultPath, resultArr, callback){

    console.log(`开始分析 ${path} 的 apk 文件!`)

    // 先清空结果文件夹
    clearDir(resultPath);

    // 新建空文件
    creatEmptyFile(resultPath, resultArr)

    // 储存有分析结果的对象
    var result = {

        // 运行 java 程序的过程中报错
        textErr : undefined,

        // 开启 java 程序的过程中报错
        javaErr : undefined,

        // 一般分析结果
        analysis_api : undefined,
        analysis_order : undefined,
        analysis_permission : undefined,
        analysis_sdk : undefined,

    }

    console.log(`java -jar ${javaPath} ${path}`)

    var javaThread = cp.exec(`java -jar -Xmn512m -Xms2048m -Xmx2048m ${javaPath} ${path}`, {
        maxBuffer: 50000 * 1024
    },function(err, stdout, stderr){
        if(err) {

            result.javaErr = html_encode(err.toString());

            callback(null, result);
        }

        // console.log("stdout " + stdout)
        // console.log("stderr " + stderr)

        // 由于运行中发生错误并不代表其他分析就没有结果, 所以暂时不返回
        if(stderr){
            result.textErr = stderr.replace(/\n/g, "<br />");
        }
    })

    javaThread.on("exit", function(state){

        // 如果 java 进程是正常结束的, 那么读取所有分析结果, 并存入数据库
        if(state === 0){
            readFileToHandle(resultPath, ["analysis_api", "analysis_order", "analysis_permission", "analysis_sdk"], function(fileObj){

                // 将换行符变成标准的 HTML 的换行
                for (let i in fileObj){
                    result[i] = html_encode(fileObj[i]);
                }

                console.log("apk 文件分析完成!")

                callback(null, result)

            })
        }
    })
}

/**
 * 读取文件, 以待回调函数处理
 * NOTICE : 文件必须是 txt 格式的文件
 * @param  {function} callback 全部读取完毕后的函数
 *                             回调函数的第一个参数是一个对象, 内容是文件名以及读取到的数据
 * @param  {string} filePath 文件路径
 * @param  {array}  fileName 文件名称, 不带扩展名
 *
 * @return 无返回, 此函数读取到的数据会以回调函数的第一个参数进行返回
 */
function readFileToHandle(filePath, fileName, callback){

    // 获取将要获取的文件数量
    var fileNum = fileName.length;

    // 待装进回调函数的对象
    var obj = {};

    for(let i = 0; i < fileName.length; i++){
        fs.readFile(filePath + fileName[i] + ".txt", "utf8", function(err, data){
            if(err) throw err;
            obj[fileName[i]] = data;
            fileNum--;

            // 如果全部文件均已读取完成, 则调用回调函数
            if (!fileNum) callback(obj);
        })
    }
}

/**
 * 将非 HTML 的内容进行转义
 * @param  {string} str 待转义字符串
 * @return {string}     已转义字符串
 */
function html_encode(str) {   
    var s = "";   
    if (str.length == 0) return "";   
    s = str.replace(/&/g, "&gt;");   
    s = s.replace(/</g, "&lt;");   
    s = s.replace(/>/g, "&gt;");   
    s = s.replace(/ /g, "&nbsp;");   
    s = s.replace(/\'/g, "&#39;");   
    s = s.replace(/\"/g, "&quot;");   
    s = s.replace(/\n/g, "<br>");   
    return s;   
}   

/**
 * 清空指定文件夹, 指定文件夹必须存在
 * @param  {string} path 要清空的文件夹的路径
 */
function clearDir (path) {
    var list = fs.readdirSync(path);
    for (var i = 0; i < list.length; i++) {
        var name = list[i];
        fs.unlinkSync(path + name);
    }
    console.log('已清空文件夹');
};


function creatEmptyFile(resultPath, resultArr){
    resultArr.forEach(function(item){
        fs.writeFile(resultPath + item + ".txt", "", function(err){if(err) throw err; })
    })
}


module.exports = doSootAnalyse;