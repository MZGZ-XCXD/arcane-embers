#!/usr/bin/env node
/**
 * 由 CHANGELOG.md 生成 js/config/changelog.js（游戏内「设置 → 更新日志」用）
 *
 * 用法：node tools/gen-changelog.js
 * 说明：改了 CHANGELOG.md 之后重新执行一次即可；游戏里读的是生成出来的那份数据，
 *       所以不需要在游戏里再维护一份日志。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'CHANGELOG.md');
const OUT = path.join(ROOT, 'js', 'config', 'changelog.js');

const md = fs.readFileSync(SRC, 'utf8');
const lines = md.split(/\r?\n/);

/* 只做很少的 markdown 处理：链接取文字、**加粗**、`代码`；先转义再加标签 */
function inline(s) {
    let t = String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
    return t.trim();
}

/* ---------- 版本历史总览表 ---------- */
const overview = [];
{
    let i = lines.findIndex(l => /^##\s+版本历史总览/.test(l));
    if (i >= 0) {
        for (; i < lines.length; i++) {
            const l = lines[i];
            if (/^##\s/.test(l) && !/版本历史总览/.test(l)) break;
            if (!/^\|/.test(l)) continue;
            const cells = l.split('|').map(c => c.trim()).filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
            if (cells.length < 4) continue;
            const version = cells[0].replace(/\*/g, '');
            if (!/^v?\d+\.\d+\.\d+$/.test(version)) continue;
            overview.push({
                version: version,
                date: cells[1],
                type: cells[2],
                summary: inline(cells[3]),
            });
        }
    }
}

/* ---------- 各版本明细 ---------- */
const versions = [];
{
    let cur = null, section = null;
    for (const raw of lines) {
        const l = raw.replace(/\s+$/, '');
        if (/^##\s+\[?[^\]]*未发布/.test(l)) { cur = null; section = null; continue; }
        const vh = /^##\s+\[([^\]]+)\]\s*[-–]\s*(\S+)/.exec(l);
        if (vh) {
            cur = { version: vh[1], date: vh[2], sections: [] };
            versions.push(cur);
            section = null;
            continue;
        }
        if (/^##\s/.test(l)) { cur = null; section = null; continue; }     // 其它二级标题（总览 / 写法说明）跳过
        if (!cur) continue;
        const sh = /^###\s+(.+)$/.exec(l);
        if (sh) {
            section = { title: sh[1].trim(), items: [] };
            cur.sections.push(section);
            continue;
        }
        if (!section) continue;
        const item = /^\*\s+(.*)$/.exec(l);
        if (item) { section.items.push(inline(item[1])); continue; }
        if (/^\s+\S/.test(raw) && section.items.length) {                   // 续行
            section.items[section.items.length - 1] += ' ' + inline(l);
        }
    }
}

const data = { source: 'CHANGELOG.md', overview: overview, versions: versions };
const js = '/* 由 tools/gen-changelog.js 自动生成，请勿直接编辑；改动请写 CHANGELOG.md 后重新生成。 */\n' +
    'window.CHANGELOG_DATA = ' + JSON.stringify(data, null, 4).replace(/<\//g, '<\\/') + ';\n';

fs.writeFileSync(OUT, js);
console.log('已生成 ' + path.relative(ROOT, OUT).replace(/\\/g, '/') +
    '（总览 ' + overview.length + ' 条，版本明细 ' + versions.length + ' 个，' +
    (js.length / 1024).toFixed(0) + ' KB）');
