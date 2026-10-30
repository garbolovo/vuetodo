const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: {},
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state(tasks, overrides = {}) {
    const result = {
        todoList: tasks.map(task => ({ parentId: null, done: false, collapsed: false, ...task })),
        activeView: 'scheduled', activeProject: null, activeTag: null, activeContext: null,
        dateFromToday: () => '2026-10-31',
        ...overrides,
    };
    result.buildScheduledTree = app.methods.buildScheduledTree.bind(result);
    return result;
}

function entries(s) {
    return JSON.parse(JSON.stringify(app.computed.viewEntries.call(s).map(entry => ({
        id: entry.item.id, depth: entry.depth, children: entry.hasChildren, context: entry.isContext,
    }))));
}

test('Scheduled shows nested context and does not duplicate matching descendants', () => {
    const s = state([
        { id: 'p', startDate: '2026-11-02' },
        { id: 'c', parentId: 'p' },
        { id: 'g', parentId: 'c', startDate: '2026-11-04' },
        { id: 'done', parentId: 'p', done: true },
        { id: 'today', startDate: '2026-10-31' },
    ]);
    assert.deepEqual(entries(s), [
        { id: 'p', depth: 0, children: true, context: false },
        { id: 'c', depth: 1, children: true, context: true },
        { id: 'g', depth: 2, children: false, context: false },
    ]);
    s.todoList[0].collapsed = true;
    assert.deepEqual(entries(s).map(entry => entry.id), ['p']);
});

test('A scheduled child is a root when its parent does not match', () => {
    const s = state([{ id: 'p' }, { id: 'c', parentId: 'p', startDate: '2026-11-02' }]);
    assert.deepEqual(entries(s), [{ id: 'c', depth: 0, children: false, context: false }]);
});

test('Tag/context filters select roots while descendants remain labelled context', () => {
    const s = state([
        { id: 'p', tags: ['Work'], context: '@home', startDate: '2026-11-02' },
        { id: 'c', parentId: 'p', startDate: '2026-11-03' },
        { id: 'other', startDate: '2026-11-03' },
    ], { activeTag: 'work', activeContext: '@home' });
    assert.deepEqual(entries(s).map(entry => [entry.id, entry.context]), [['p', false], ['c', true]]);
});
