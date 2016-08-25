"use strict";

var request       = require("superagent");
var cheerio       = require("cheerio");
var db            = require("./database.js")("WandoujiaAPP")
var getAPK        = require("./getAPK.js")
var doSootAnalyse = require("./doSootAnalyse/doSootAnalyse.js")

var list        = [];
var category    = [];

// getAPPName("http://www.wandoujia.com/category/408", 12)
// getAPK("http://www.wandoujia.com/apps/com.hoteltonight.android.prod/download", "./apkDownload/", "com.lanteanstudio.compass" + ".apk", function(err){
//     if(err) throw err;
//     console.log(1)
// })


getCategory(function(){
    getMoreAPPName(function(){
        stepDownloadAndAnalyse();
    })
});

// 定时扩充目录
setInterval(function(){
    if(list.length > 100) return;
    getMoreAPPName();
}, 5000)


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
            if(err) throw err;
            
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

            // // 随机下载一个软件
            // getAPK(`http://www.wandoujia.com/apps/${list[5].name}/download`, __dirname + "/apkDownload/", list[5].name + ".apk", function(err){
            //     if(err) throw err;

            //     // 下载结束后进行分析
            //     doSootAnalyse(__dirname + "/apkDownload/" +　list[5].name + ".apk", __dirname + "/newSoot/newSoot.jar", __dirname + "/result/", ["analysis_api", "analysis_order", "analysis_permission", "analysis_sdk"], function(){})
            // })
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

    if(list.length === 0) {setTimeout(function(){stepDownloadAndAnalyse()}, 5000);}
    var apkToGet = list.pop();

    console.log(`list 数组里还有 ${list.length} 个元素`)
    if(list.length < 15) getMoreAPPName();

    // 在下载并分析应用前, 先检查是否已经分析过了
    db.collection("Wandoujia").findOne({name : apkToGet.name}, function(err, result){
        if(err) throw err;

        if(result && !result.javaErr){
            console.log(`${apkToGet.name} 之前已被分析过, 故跳过!`);
            stepDownloadAndAnalyse();
            return;
        }

        if(result){
            db.collection("Wandoujia").remove(result, function(err){
                if(err) throw err;
                console.log(`${apkToGet.name} 之前已被分析过但含有错误, 已删除之前记录, 并即将开始重新分析!`)
            })
        }

        console.log(`即将开始下载并分析 ${apkToGet.name}`);

        // 开始下载并分析
        getAPK(`http://www.wandoujia.com/apps/${apkToGet.name}/download`, __dirname + "/apkDownload/", apkToGet.name + ".apk", function(err){
            if(err) {
                console.log("下载应用中发送错误 : " + err);
                return stepDownloadAndAnalyse();
            }

            doSootAnalyse(__dirname + "/apkDownload/" +　apkToGet.name + ".apk", __dirname + "/newSoot/newSoot.jar", __dirname + "/result/", ["analysis_api", "analysis_order", "analysis_permission", "analysis_sdk", "analysis_minapilevel"], function(err, result){
                if(err) throw err;

                Object.assign(result, apkToGet, {
                    query_time : new Date().toLocaleString()
                });

                db.collection("Wandoujia").insert(result, function(err){
                    if(err) throw err;

                    console.log(`${result.name} 的信息已加入数据库`)

                    // 继续下一步操作
                    stepDownloadAndAnalyse();
                })
            })
        })


    })

    
}

// http://www.wandoujia.com/apps/com.tujia.hotel/download