#!/usr/bin/env node
/**
 * 给 index.html 里的 css / js 引用打上版本号（例如 js/ui/app.js?v=0.7.4）。
 *
 * 为什么需要：浏览器会缓存这些文件，地址不变就一直用旧的 —— 曾经有玩家因此
 * 一直跑着好几个版本之前的代码（修好的东西显示不出来）。加上 ?v=版本号 之后，
 * 每次发版地址都变了，浏览器必定重新下载。
 *
 * 版本号取 CHANGELOG.md 里最新的正式版本（跳过 [未发布]）。
 * 用法：node tools/stamp-version.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CHANGELOG = path.join(ROOT, 'CHANGELOG.md');
const INDEX = path.join(ROOT, 'index.html');

const md = fs.readFileSync(CHANGELOG, 'utf8');
const found = /^##\s+\[(\d+\.\d+\.\d+)\]/m.exec(md);
if (!found) {
    console.error('没在 CHANGELOG.md 里找到正式版本号（形如 "## [0.7.4] - 2026-10-14"）。');
    process.exit(1);
}
const version = found[1];

let html = fs.readFileSync(INDEX, 'utf8');
let count = 0;
/* 先把可能已有的 ?v=... 去掉再重新拼，重复执行结果一致 */
html = html.replace(/(href="css\/[^"?]+\.css)(?:\?[^"]*)?"/g, (match, base) => {
    count++;
    return base + '?v=' + version + '"';
});
html = html.replace(/(src="js\/[^"?]+\.js)(?:\?[^"]*)?"/g, (match, base) => {
    count++;
    return base + '?v=' + version + '"';
});

if (!count) {
    console.error('index.html 里没有找到 css / js 引用，什么都没改。');
    process.exit(1);
}
fs.writeFileSync(INDEX, html);
console.log('已把 index.html 里的 ' + count + ' 个引用标记为 v=' + version);
