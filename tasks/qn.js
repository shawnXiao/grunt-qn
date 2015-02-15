var qn = require('qn');
var fs = require('fs');
var path = require('path');
var crypto = require("crypto");
var grunt = require("grunt");
var chalk = require("chalk");

module.exports = function (grunt) {
    grunt.registerMultiTask("qn", "upload files to qn CDN", function () {
        var options = this.options();
        var config = this.data;
        var done = this.async();
        var client = qn.create(config.client);
        var configFile = config.configFile;

        var optionsLength = config.files.length;
        var imgFolderHash;
        var configFileContent = fs.readFileSync(configFile, 'utf-8');
        config.files.forEach(function (folderItem) {
            var temptFolder = folderItem.folder;
            var temptExtName = folderItem.extNames;
            walkFolder(temptFolder, function (err, results) {
                if (!results) {
                    return;
                }
                var folderHash = ""
                results.forEach(function (fileItem) {
                    var extName = path.extname(fileItem);
                    if (temptExtName.indexOf(extName) >= 0) {
                        var relativePath = path.relative('./dist/', fileItem);
                        var fileContent = fs.readFileSync(fileItem, 'utf-8');
                        if (extName === ".css") {
                            var backgroundImgReg = /(?:src=|url\(\s*)['"]?([^'"\)(\?|#)]+)['"]?\s*\)?/gm;
                            var temptContent = fileContent.replace(backgroundImgReg, function (match, src) {
                                var baseName = path.basename(src);
                                var res = match.replace(src, config.client.domain + '/' + imgFolderHash + src.replace('/static', ''));
                                return res;
                            });
                            fs.writeFileSync(fileItem, temptContent, 'utf-8')
                        }
                        folderHash += crypto.createHash("md5").update(fileContent).digest('hex').substr(5);
                    }
                });

                folderHash = crypto.createHash("md5").update(folderHash).digest('hex').substr(5);
                if (folderItem.configKey) {
                    var configKeyRegStr = "(?:" + folderItem.configKey + ")[\'\"]?:\\s*[\'\"](.+)[\'\"]";
                    var configKeyReg = new RegExp(configKeyRegStr);
                    configFileContent = configFileContent.replace(configKeyReg, function (match, src) {
                        var res = match.replace(src, config.client.domain + '/' + folderHash);
                        return res;
                    })
                }

                if (temptExtName.indexOf("png")) {
                    imgFolderHash = folderHash;
                }
                grunt.log.writeln(chalk.green('Path:'  + temptFolder + ", folder hash is " + folderHash));

                var resultsLength  = results.length;
                results.forEach(function (fileItem) {
                    var extName = path.extname(fileItem);
                    if (temptExtName.indexOf(extName) >= 0) {
                        var relativePath = folderHash + "/" + path.relative('./dist/', fileItem);
                        if (extName === ".css") {
                            var fileContent = fs.readFileSync(fileItem, 'utf-8');
                        }
                        client.upload(fs.createReadStream(fileItem), {key: relativePath}, function (err, result) {
                            resultsLength --;
                            if (err) {
                                grunt.log.warn(err);
                            }
                            grunt.log.writeln('File ' + chalk.cyan(result.url) + ' created.');
                            if (resultsLength === 0 && optionsLength === 0) {
                                fs.writeFileSync(configFile, configFileContent, 'utf-8')
                                grunt.log.writeln(chalk.blue('Config File write done'));
                                done();
                            }
                        });
                    }
                });

            });
            optionsLength --;
        });


        function walkFolder(startPath, callback) {
            var results = [];
            var fileList = fs.readdirSync(startPath);
            var pending = fileList.length;
            if (!pending) {
                return callback(null, results)
            }
            fileList.forEach(function (fileItem) {
                var filePath = startPath + '/' + fileItem;
                var stat = fs.statSync(filePath);
                if (stat && stat.isDirectory()) {
                    walkFolder(filePath, function (err, res) {
                        results = results.concat(res);
                        if (!--pending) {
                            callback(null, results);
                        }
                    });
                } else {
                    results.push(filePath);
                    if (!--pending) {
                        callback(null, results);
                    }
                }
            });
        }

    });
}
