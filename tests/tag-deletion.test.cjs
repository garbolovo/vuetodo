const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
let keydown;
const documentStub = { activeElement: null, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: {
        matchMedia: () => ({ matches: false }),
        addEventListener(type, fn) { if (type === 'keydown') keydown = fn; },
    },
    document: documentStub,
    localStorage: { getItem: () => null },
    clearTimeout, setTimeout,
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state() {
    const s = {
        todoList: [
            { id: 'a', tags: ['Work', 'Urgent'] },
            { id: 'b', tags: ['Home', 'work'] },
            { id: 'c', tags: ['Work'] },
            { id: 'd', tags: [] },
            { id: 'e' },
        ],
        activeTag: null,
        tagDeleteName: null,
        tagDeleteReturnFocus: null,
        tagRegistry: ['Work', 'Home', 'Urgent', 'Someday'],
        saves: 0, tagSaves: 0, cancelFocus: 0, restoreFocus: 0,
        $nextTick: callback => { if (callback) callback(); },
    };
    s.$refs = {
        tagDeleteCancel: { focus() { s.cancelFocus++; } },
        tagCloud: { querySelector: () => ({ focus() { s.restoreFocus++; } }) },
    };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    for (const [name, fn] of Object.entries(app.computed)) Object.defineProperty(s, name, { get: () => fn.call(s) });
    s.saveTodos = () => { s.saves++; };
    s.saveTagRegistry = () => { s.tagSaves++; };
    s.syncWithServer = () => {};
    return s;
}

test('Opening the confirm dialog reports how many tasks use the tag, case-insensitively', () => {
    const s = state();
    const trigger = { isConnected: true, focus() {} };
    documentStub.activeElement = trigger;
    s.requestTagDelete('wOrK');
    assert.equal(s.tagDeleteName, 'wOrK');
    assert.equal(s.tagDeleteCount, 3);
    assert.equal(s.cancelFocus, 1);
    assert.equal(s.tagDeleteReturnFocus, trigger);
});

test('Confirming removes the tag from every task and saves once', () => {
    const s = state();
    const original = JSON.stringify(s.todoList);
    s.requestTagDelete('work');
    s.confirmTagDelete();
    assert.deepEqual(Array.from(s.todoList[0].tags), ['Urgent']);
    assert.deepEqual(Array.from(s.todoList[1].tags), ['Home']);
    assert.deepEqual(Array.from(s.todoList[2].tags), []);
    assert.deepEqual(Array.from(s.todoList[3].tags), []);
    assert.equal('tags' in s.todoList[4], false, 'tasks without tags are left untouched');
    assert.notEqual(JSON.stringify(s.todoList), original);
    assert.equal(s.tagDeleteName, null);
    assert.equal(s.saves, 1);
    assert.deepEqual(Array.from(s.tagRegistry), ['Home', 'Urgent', 'Someday']);
    assert.equal(s.tagSaves, 1, 'the tag is also removed from the registry');
});

test('Deleting the active tag clears its filter, other filters stay put', () => {
    const s = state();
    s.activeTag = 'Work';
    s.requestTagDelete('WORK');
    s.confirmTagDelete();
    assert.equal(s.activeTag, null);

    const other = state();
    other.activeTag = 'Urgent';
    other.requestTagDelete('work');
    other.confirmTagDelete();
    assert.equal(other.activeTag, 'Urgent');
});

test('Cancelling changes nothing, restores focus, and Escape closes the dialog', () => {
    const s = state();
    const before = JSON.stringify(s.todoList);
    const trigger = { isConnected: true, focus() { s.restoreFocus++; } };
    documentStub.activeElement = trigger;
    s.requestTagDelete('Work');
    s.cancelTagDelete();
    assert.equal(s.tagDeleteName, null);
    assert.equal(s.saves, 0);
    assert.equal(JSON.stringify(s.todoList), before);
    assert.equal(s.restoreFocus, 1);

    const escapeState = state();
    app.mounted.call(escapeState);
    escapeState.requestTagDelete('Home');
    keydown({ key: 'Escape' });
    assert.equal(escapeState.tagDeleteName, null);
    assert.equal(escapeState.saves, 0);
});
