"use strict";

var request = require("superagent");
var fs      = require("fs");

/**
 * 下载 APK 文件
 * @param  {string}   url      apk 的下载链接
 * @param  {string}   path     本地路径
 * @param  {string}   apkName  apk的名称, 参数中应该包含 ".apk" 的扩展名
 * @param  {Function} callback 回调函数, 参数1 为错误
 */
function getAPK(url, path, apkName, callback){

    console.log(`开始下载 ${url} 的 apk 文件...`)

    // 建立请求
    var req = request.get(url).timeout(300000);

    // 获取 apk 的名称
    var match = (/\/([^\/]*\.apk)\??/).exec(req.url);
    var apkName = apkName || (match != null ? match[1] : new Date().getTime() + ".apk");
        
    var stream = fs.createWriteStream(path + apkName);
    req.pipe(stream)

    // 下载成功后调用回调函数
    req.on("end", function(){

        console.log("apk 文件下载完成!")

        callback(null)
    })

    // 出现失败后调用回调函数
    req.on("error", function(err){
        callback(err);
    })

}

/**
 * 几个需要注意的地方:
 *
 * 1.  流传输的处理不能在 end 里面处理, 必须定义 req, 并在外面进行处理
 * 2.  下载同样的内容, 其文件大小也是有可能不一致的, 因此不能通过文件大小或者 md5 判断文件是否相同
 */

module.exports = getAPK;