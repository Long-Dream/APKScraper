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

    // 先清空结果文件夹
    // clearDir(resultPath);

    // 新建空文件
    creatEmptyFile(resultPath, resultArr)

    // 储存有分析结果的对象
    var result = {};

    var cmd = `java -jar -Xmn412m -Xms1300m -Xmx1300m ${javaPath} ${path}`;

    // console.log(cmd)

    var javaThread = cp.exec(cmd, {
        maxBuffer: 50000 * 1024,
        timeout : 120000        // 若在 120 秒内没有分析完成, 则进行下一个操作
    },function(err, stdout, stderr){
        if(err) {

            result.javaErr = err.toString();

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

            // 杀死残余的 java 进程
            if (process.platform === "win32") killThreadByName("java.exe");
            if (process.platform === "linux") killThreadByName("java");

            readFileToHandle(resultPath, resultArr, function(fileObj){

                // 将换行符变成标准的 HTML 的换行
                for (let i in fileObj){
                    result[i] = fileObj[i];
                }

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

/**
 * 建立指定的结果空文件, 若已有文件, 则覆盖
 * @param  {string} resultPath 结果文件夹的路径
 * @param  {array } resultArr  结果文件名的数组
 */
function creatEmptyFile(resultPath, resultArr){
    resultArr.forEach(function(item){
        fs.writeFile(resultPath + item + ".txt", "", function(err){if(err) throw err; })
    })
}

/**
 * 根据进程名称杀死所有符合该进程名的进程
 * @param  {string}   name     进程名称
 */
function killThreadByName(name){
    if (process.platform === "win32") {
        findPIDbyNameInWindows(name, function(err, pidArr){
            if(err) throw err;

            setTimeout(function(){
                pidArr.forEach(function(item){
                    cp.exec(`taskkill /F /PID ${item}`, function(err, stdout, stderr){
                        if(err) {return console.log(err)};
                        console.log(stdout, stderr);
                    })
                })
            }, 2000);
            
        })
    } else if (process.platform === "linux") {
        findPIDbyNameInLinux(name, function(err, pidArr){
            if(err) throw err;

            setTimeout(function(){
                pidArr.forEach(function(item){
                    cp.exec(`kill -s 9 ${item}`, function(err, stdout, stderr){
                        if(err) {return console.log(err)};
                        console.log(stdout, stderr);
                    })
                })
            }, 2000)

        })
    } else {
        throw new Error("杀死进程任务，尚不兼容当前平台")
    }
}

/**
 * 根据进程名称获取所有符合该进程名的进程的 PID --- Windows 平台
 * @param  {string}   name     进程名称
 * @param  {Function} callback 回调函数
 *                             参数 2 是包含有所有符合条件的进程的数组
 */
function findPIDbyNameInWindows(name, callback) {

    var pidArr = [];

    if (process.platform !== "win32") {throw new Error("操作系统平台不是 win32, 请检查代码");}
    cp.exec("tasklist", function(err, stdout, stderr){
        if(err){ callback(err); }

        stdout.split('\n').filter(function(line){
            var p = line.trim().split(/\s+/), pname=p[0], pid=p[1];
            if(pname.toLowerCase().indexOf(name) === 0 && parseInt(pid)){
                pidArr.push(pid);
            }
        });

        callback(null, pidArr)
    })
}

/**
 * 根据进程名称获取所有符合该进程名的进程的 PID --- Linux 平台
 * @param  {string}   name     进程名称
 * @param  {Function} callback 回调函数
 *                             参数 2 是包含有所有符合条件的进程的数组
 */
function findPIDbyNameInLinux(name, callback) {

    var pidArr = [];

    if (process.platform !== "linux") {throw new Error("操作系统平台不是 linux, 请检查代码");}
    cp.exec("ps -A", function(err, stdout, stderr){
        if(err){ callback(err); }

        stdout.split('\n').filter(function(line){
            var p = line.trim().split(/\s+/);
            if(p.length === 1) return;
            var pname=p[3], pid=p[0];
            if(pname.toLowerCase().indexOf(name) === 0 && parseInt(pid)){
                pidArr.push(pid);
            }
        });

        callback(null, pidArr)
    })
}

module.exports = doSootAnalyse;