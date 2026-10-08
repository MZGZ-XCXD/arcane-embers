#!/usr/bin/env node
/**
 * 单文件版打包脚本
 *
 * 用法：node tools/build-single-file.js
 * 输出：dist/arcane-embers.html
 *
 * 作用：把 index.html 里引用的 css/style.css 与全部 js/**\/*.js 内联进一个 HTML，
 *       生成可以直接双击运行、也方便分享的单文件版本。
 * 注意：改动 js/、css/ 或 index.html 之后需要重新执行一次本脚本。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'arcane-embers.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const inlined = [];

html = html.replace(/<link rel="stylesheet" href="([^"]+)">/g, (match, file) => {
    inlined.push(file);
    return '<style>\n' + fs.readFileSync(path.join(ROOT, file), 'utf8') + '\n</style>';
});

html = html.replace(/<script src="([^"]+)"><\/script>/g, (match, file) => {
    inlined.push(file);
    const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
    return '<script>\n/* ===== ' + file + ' ===== */\n' + code + '\n</script>';
});

html = html.replace(
    '<!DOCTYPE html>',
    '<!DOCTYPE html>\n<!-- 单文件版：由 tools/build-single-file.js 自动生成，请勿直接编辑本文件；' +
    '改动请修改 index.html / css / js 后重新构建。 -->'
);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const left = (html.match(/<script src=|<link rel="stylesheet"/g) || []).length;
console.log('已生成 ' + path.relative(ROOT, OUT).replace(/\\/g, '/') +
    '（' + (html.length / 1024).toFixed(0) + ' KB，内联 ' + inlined.length + ' 个文件）');
if (left > 0) {
    console.error('警告：仍有 ' + left + ' 个外部引用未被内联。');
    process.exitCode = 1;
}
