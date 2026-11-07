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
    const s = {
        todoList: tasks.map(task => ({ parentId: null, done: false, ...task })),
        activeView: 'inbox',
        activeProject: null,
        activeTag: null,
        activeContext: null,
        showCompleted: false,
        filteredOn: false,
        ...overrides,
    };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    for (const [name, fn] of Object.entries(app.computed)) {
        Object.defineProperty(s, name, { get: () => fn.call(s) });
    }
    return s;
}

function ids(s) {
    return s.viewEntries.map(entry => entry.item.id);
}

test('Inbox contains active tasks without a start date or a due date', () => {
    const s = state([
        { id: 'none' },
        { id: 'empty', startDate: '', dueDate: '' },
        { id: 'spaces', startDate: '   ', dueDate: '  ' },
        { id: 'started', startDate: '2026-11-07' },
        { id: 'due', dueDate: '2026-11-07' },
        { id: 'both', startDate: '2026-11-07', dueDate: '2026-11-08' },
        { id: 'done', done: true },
    ]);
    assert.deepEqual(ids(s), ['none', 'empty', 'spaces']);
    assert.equal(s.inboxCount, 3);
});

test('Inbox is a flat list and includes matching subtasks', () => {
    const s = state([
        { id: 'parent' },
        { id: 'child', parentId: 'parent' },
        { id: 'dated-child', parentId: 'parent', dueDate: '2026-11-07' },
    ]);
    assert.deepEqual(ids(s), ['parent', 'child']);
    assert.deepEqual(s.viewEntries.map(entry => entry.depth), [0, 0]);
});

test('Context and tag filters narrow the Inbox, case-insensitively', () => {
    const s = state([
        { id: 'match', tags: ['Work'], context: '@home' },
        { id: 'other-tag', tags: ['Home'], context: '@home' },
        { id: 'other-context', tags: ['Work'], context: '@computer' },
    ], { activeTag: 'work', activeContext: '@home' });
    assert.deepEqual(ids(s), ['match']);
});

test('Inbox label, empty state and sidebar entry are wired up', () => {
    const s = state([{ id: 'none' }]);
    assert.equal(s.activeViewLabel, 'Inbox');
    assert.equal(s.emptyStateMessage, 'Tasks without start or due dates will appear here.');

    const empty = state([]);
    assert.equal(empty.emptyStateMessage, 'Tasks without start or due dates will appear here.');

    const first = s.sidebarViews[0];
    assert.equal(first.id, 'inbox');
    assert.equal(first.label, 'Inbox');
    assert.equal(first.count, 1);
});
