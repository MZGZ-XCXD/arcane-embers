/* 时代：按已达成的里程碑科技推进，影响界面氛围文本 */
(function () {
    const ERAS = [
        { id: 1, name: '灰烬时代', motto: '灰烬之下，仍有火星。', test: () => true },
        { id: 2, name: '学徒时代', motto: '第一枚符文亮起时，世界重新学会呼吸。', test: s => s.techs['魔力感知'] && s.techs['魔力感知'].researched },
        { id: 3, name: '学院时代', motto: '知识不再属于个人，而属于文明。', test: s => s.techs['咒法学'] && s.techs['咒法学'].researched },
        { id: 4, name: '高塔时代', motto: '我们把城市举向天空，为了离星辰更近。', test: s => s.techs['浮空石'] && s.techs['浮空石'].researched },
        { id: 5, name: '星界时代', motto: '星图另一端，也许还有别的废墟。', test: s => s.techs['星界航行'] && s.techs['星界航行'].researched },
        { id: 6, name: '虚空时代', motto: '当规则也能被书写，重建便成了创世。', test: s => s.techs['虚空撕裂'] && s.techs['虚空撕裂'].researched },
        { id: 7, name: '星渊时代', motto: '城市把手伸进星渊，边界从此只是选项。', test: s => s.techs['相位工学'] && s.techs['相位工学'].researched },
        { id: 8, name: '归墟时代', motto: '当世界本身成为材料，重建就是在复述自己。', test: s => s.techs['归墟之门'] && s.techs['归墟之门'].researched },
    ];

    window.ERAS = ERAS;
    window.getCurrentEra = function (state) {
        let cur = ERAS[0];
        for (const e of ERAS) if (e.test(state)) cur = e;
        return cur;
    };
})();
