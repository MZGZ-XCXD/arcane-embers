/* 设置标签页：存档、运行与显示、玩法速览、更新日志 */
(function () {
    const U = window.Utils;
    const G = window.UI;

    /* ---------------- 存档 ---------------- */
    function saveSection() {
        const s = GameState;
        let html = '<div class="section-title">存档</div><div class="settings-card">';
        html += '<div class="hint">进度保存在浏览器本地（约每 25 秒自动保存一次，离开页面时也会保存）。' +
            '也可以导出成一段文本自己收好，或者把导出的文本粘贴回来覆盖当前进度。</div>';
        html += '<div class="btn-row mt6">';
        html += '<button class="btn" data-act="save">💾 立即保存</button>';
        html += '<button class="btn" data-act="modal|export">📤 导出存档</button>';
        html += '<button class="btn" data-act="modal|import">📥 导入存档</button>';
        html += '</div>';
        html += '<div class="mt6" style="display:flex;gap:14px;flex-wrap:wrap">';
        html += '<label class="hint" style="cursor:pointer"><input type="checkbox" data-act="toggleAutosave"' +
            (s.settings.autosave ? ' checked' : '') + '> 启用自动保存</label>';
        html += '</div>';
        html += '<div class="section-sub">危险操作</div>';
        html += '<div class="hint">清除本地存档会彻底删除进度，包括所有传承强化、成就与英雄收藏，无法恢复。</div>';
        html += '<div class="btn-row mt6"><button class="btn danger" data-act="modal|hardreset">清除存档</button></div>';
        html += '</div>';
        return html;
    }

    /* ---------------- 运行与显示 ---------------- */
    /* 自动化开关：没解锁时也照样显示一行，并说明去哪儿解锁 —— 否则玩家根本找不到这个开关 */
    function autoRow(opts) {
        const s = GameState;
        const unlocked = EffectsManager.hasSpecial(s, opts.special);
        if (!unlocked) {
            return '<div class="auto-row"><span class="hint">🔒 <b>' + G.esc(opts.name) + '</b>：未解锁　—　' +
                G.esc(opts.how) + '</span></div>';
        }
        return '<div class="auto-row"><label class="hint" style="cursor:pointer">' +
            '<input type="checkbox" data-act="' + opts.act + '"' + (s.settings[opts.setting] ? ' checked' : '') + '> ' +
            '<b>' + G.esc(opts.name) + '</b>：' + G.esc(opts.desc) + '</label></div>';
    }

    function runSection() {
        const s = GameState;
        let html = '<div class="section-title">运行与显示</div><div class="settings-card">';
        html += '<div class="btn-row">';
        html += '<button class="btn" data-act="pause">' + (s.paused ? '▶ 继续游戏' : '⏸ 暂停游戏') + '</button>';
        html += '<button class="btn" data-act="theme">' + (s.settings.theme === 'dark' ? '☀ 切换到浅色主题' : '🌙 切换到深色主题') + '</button>';
        html += '</div>';
        html += '<div class="section-sub">自动化</div>';
        html += '<div class="mt6" style="display:flex;flex-direction:column;gap:6px">';
        html += autoRow({
            special: 'autoBuild', setting: 'autoBuild', act: 'toggleAutoBuild',
            name: '自动符文（自动建造）',
            desc: '买得起就立刻建，不会把买不起的塞进队列',
            how: '在「传承 → 奥术遗物」里购买传承强化「自动符文」后，本页会出现这个开关',
        });
        html += autoRow({
            special: 'autoExpedition', setting: 'autoExpedition', act: 'toggleAutoExp',
            name: '自动远征',
            desc: '上一支队伍归来后立刻前往同一区域',
            how: '先在「传承 → 奥术遗物」里买「自动符文」，再买「自动远征」',
        });
        html += '</div>';
        html += '<div class="hint mt6">离线收益上限 ' + (2 + EffectsManager.additive(s, 'offlineHours')) + ' 小时（' +
            (EffectsManager.hasSpecial(s, 'offlinePerfect') ? '100%' : '50%') + ' 效率）。' +
            '键盘：数字键 1-9 与 0 切换标签页，空格暂停，Ctrl+S 保存。</div>';
        html += '</div>';
        return html;
    }

    /* ---------------- 玩法速览 ---------------- */
    function guideSection() {
        let html = '<div class="section-title">玩法速览</div><div class="settings-card"><ul class="guide-list">';
        html += '<li>大多数建筑需要<b>人口</b>才能运转，人口由居所提供。</li>';
        html += '<li>建筑的效率会同时受「原料短缺」与「人手不足」限制，效率又反过来影响产量与消耗。</li>';
        html += '<li>研究与建造都受资源<b>上限</b>限制，用仓库类建筑提高上限。</li>';
        html += '<li>建造 / 研究 / 升级：材料够就<b>立即完成</b>；不够时点击会<b>排队等材料</b>，右侧面板显示还要多久凑齐，凑齐的瞬间自动建成。</li>';
        html += '<li>「时空回响」等重置会清空这一轮的进度，但保留传承资源、传承强化、成就、试炼与英雄收藏。</li>';
        html += '</ul></div>';
        return html;
    }

    /* ---------------- 更新日志 ---------------- */
    function changelogSection() {
        const d = window.CHANGELOG_DATA;
        if (!d || !d.versions || !d.versions.length) {
            return '<div class="section-title">更新日志</div><div class="settings-card"><div class="hint">没有找到更新日志数据。</div></div>';
        }
        let html = '<div class="section-title">更新日志</div><div class="settings-card">';
        html += '<div class="hint">所有改动都按版本记录在这里，最新的排在最上面。完整文档见仓库里的 CHANGELOG.md。</div>';
        /* 版本总览 */
        html += '<div class="cl-overview">';
        for (const row of d.overview) {
            html += '<div class="cl-row">' +
                '<span class="cl-ver">' + G.esc(row.version) + '</span>' +
                '<span class="cl-date">' + G.esc(row.date) + '</span>' +
                '<span class="cl-sum">' + row.summary + '</span>' +
                '</div>';
        }
        html += '</div>';
        /* 各版本明细 */
        html += '<div class="cl-box">';
        for (const v of d.versions) {
            html += '<div class="cl-version"><div class="cl-version-head">' +
                '<span class="cl-ver">' + G.esc(v.version) + '</span>' +
                '<span class="cl-date">' + G.esc(v.date) + '</span></div>';
            for (const sec of v.sections) {
                html += '<div class="cl-section">' + G.esc(sec.title) + '</div>';
                html += '<ul class="cl-items">';
                for (const it of sec.items) html += '<li>' + it + '</li>';
                html += '</ul>';
            }
            html += '</div>';
        }
        html += '</div>';
        html += '</div>';
        return html;
    }

    function render() {
        let html = '<div class="tab-intro">这一页是存档、运行选项与更新日志。游戏内的说明与快捷入口都收在这里，' +
            '顶栏右侧的 ⚙ 也会直接跳到本页。</div>';
        html += saveSection();
        html += runSection();
        html += guideSection();
        html += changelogSection();
        return html;
    }

    window.TabSettings = { render };
})();
