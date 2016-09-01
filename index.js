"use strict";

var request       = require("superagent");
var cheerio       = require("cheerio");
var db            = require("./database.js")("WandoujiaAPP")
var getAPK        = require("./getAPK.js")
var doSootAnalyse = require("./doSootAnalyse/doSootAnalyse.js")

var list        = [];
var category    = [];

var collectionName = "Wandoujia"

var resultArr = ["analysis_api", "analysis_order", "analysis_permission", "analysis_sdk", "analysis_minapilevel", "analysis_activity_and_action"];

// 先临时设置一个计数器, 计数连续执行程序出错的次数, 如果达到 5 就抛出错误
var errCounter = 0;

getCategory(function(){
    getMoreAPPName(function(){
        stepDownloadAndAnalyse();
    })
});

// 定时扩充目录
setInterval(function(){
    if(list.length > 100) return;
    getMoreAPPName();
}, 2000)


/**
 * 在目录下获取文件名称
 * 并将获取到的数据加入数组中
 * @param  {number} id      目录的 index
 * @param  {Function} next  接下来要执行的函数 可选
 */
function getAPPName(id, next){

    console.log(`开始获取目录 ${category[id].href} 第 ${category[id].curPage} 页下的 APP 内容`);

    // 计算要访问的地址
    // 第一页的形式为 http://www.wandoujia.com/category/408
    // 第二页的形式为 http://www.wandoujia.com/category/408_2
    var url = category[id].curPage === 1? category[id].href : category[id].href + "_" + category[id].curPage;

    category[id].curPage ++;

    request.get(url)
        .end(function(err, data){
            if(err) return console.log(err);
            
            var $ = cheerio.load(data.text);

            if(category[id].totalPage === 1000){
                category[id].totalPage = $(".page-item").eq(-2).text();
            }

            $("li.card").each(function(){
                list.push({
                    name    : $(this).attr("data-pn"),
                    chsname : $(this).find("h2.app-title-h2 a").text(),
                    num     : $(this).find("div.meta span").eq(0).text(),
                    size    : $(this).find("div.meta span").eq(2).text(),
                    type    : category[id].title
                })
            })

            console.log(`目录获取完成, 此时列表里含有 ${list.length} 个app信息!`)

            if(next) next();

        })
}


// 获取目录
function getCategory(next){

    console.log("开始获取目录...")

    request.get("http://www.wandoujia.com/apps")
        .end(function(err, data){
            if(err) throw err;

            var $ = cheerio.load(data.text);
            $(".child-cate a").each(function(){
                category.push({
                    title       : $(this).attr("title"),
                    href        : $(this).attr("href"),
                    curPage     : 1,
                    totalPage   : 1000
                })
            })

            console.log("目录获取完成!")

            next();
        })
}

/**
 * 获取更多的 APP 的信息
 * @param  {Function} next 接下来要进行的函数, 可选
 */
function getMoreAPPName(next){
    for(let i = 0; i < category.length; i++){
        if(category[i].curPage < category[i].totalPage){

            // 获取指定目录的APP
            if(next) getAPPName(i, next);
            else getAPPName(i);

            break;
        }
    }
}

/**
 * 单步, 进行单个 apk 的下载与分析
 * 鉴于分析 apk 需要大量性能, 下载 apk 和 分析 apk 不会同时进行
 * 同时, 每次会对 list 数组进行监听, 如果元素数量过少, 则补充数据
 */
function stepDownloadAndAnalyse(){

    if(list.length === 0) {return setTimeout(function(){stepDownloadAndAnalyse()}, 5000);}

    var apkToGet = list.pop();

    // 判断是否是已有错误的 flag
    var secondFlag = 0;

    console.log(`list 数组里还有 ${list.length} 个元素`)

    // 在下载并分析应用前, 先检查是否已经分析过了
    db.collection(collectionName).findOne({name : apkToGet.name}, function(err, result){
        if(err) throw err;

        if(result && !result.javaErr){
            console.log(`${apkToGet.name} 之前已被分析过, 故跳过!`);
            stepDownloadAndAnalyse();
            return;
        }

        if(result && result.secondFlag === 1){
            console.log(`${apkToGet.name} 之前分析中连续两次发生错误, 故跳过!`);
            stepDownloadAndAnalyse();
            return;
        }

        if(result){

            // 数据库中有记录但是 secondFlag 还是 0, 说明第一次分析中发生了错误, 将 secondFlag 置为 1 后开始第二次分析
            secondFlag = 1;

            // 因为以前出现过错误，所以再出现错误也不稀奇，故此次分析不在错误计数中
            if (errCounter > 0) errCounter--;

            db.collection(collectionName).remove(result, function(err){
                if(err) throw err;
                console.log(`${apkToGet.name} 之前已被分析过但含有错误, 已删除之前记录, 并即将开始第二次分析!`)
            })
        }

        console.log(`即将开始下载并分析 ${apkToGet.name}`);

        // 开始下载并分析
        getAPK(`http://www.wandoujia.com/apps/${apkToGet.name}/download`, __dirname + "/apkDownload/", apkToGet.name + ".apk", function(err){
            if(err) {
                console.log("下载应用中发送错误 : " + err);
                return stepDownloadAndAnalyse();
            }

            console.log(`开始分析 ${apkToGet.name} 的 apk 文件!`)

            doSootAnalyse(__dirname + "/apkDownload/" +　apkToGet.name + ".apk", __dirname + "/newSoot/newSoot.jar", __dirname + "/result/", resultArr, function(err, result){
                if(err) throw err;

                console.log(`分析完成 ${apkToGet.name}!`);

                if (result.javaErr) {

                    errCounter++;
                    console.log(`连续出错次数已达 ${errCounter} 次!`);

                    if(errCounter === 5) {
                        console.log(process.memoryUsage())
                        throw new Error("连续出错次数达到 5 次!")
                    }
                } else {
                    if (errCounter > 0) errCounter--;
                }

                Object.assign(result, apkToGet, {
                    query_time : new Date().toLocaleString(),
                    secondFlag : secondFlag
                });

                db.collection(collectionName).insert(result, function(err){
                    if(err) throw err;

                    console.log(`信息已加入数据库 :　${result.name}`)

                    // 继续下一步操作
                    stepDownloadAndAnalyse();
                })
            })
        })
    })
}

// http://www.wandoujia.com/apps/com.tujia.hotel/download