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
    localStorage: { getItem: () => null, setItem() {} },
    clearTimeout, setTimeout,
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state() {
    const s = {
        todoList: [
            { id: 'a', tags: ['Work'] },
            { id: 'b', tags: ['home', 'Urgent'] },
        ],
        tagRegistry: ['Someday', 'Work'],
        tagAddOpen: false,
        addTagName: '',
        addTagError: '',
        tagDeleteName: null,
        tagDeleteReturnFocus: null,
        activeTag: null,
        saves: 0, tagSaves: 0, inputFocus: 0, triggerFocus: 0,
        $nextTick: callback => { if (callback) callback(); },
    };
    s.$refs = {
        addTagInput: { focus() { s.inputFocus++; } },
        addTagTrigger: { focus() { s.triggerFocus++; } },
        tagDeleteCancel: { focus() {} },
        tagCloud: { querySelector: () => null },
    };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    for (const [name, fn] of Object.entries(app.computed)) Object.defineProperty(s, name, { get: () => fn.call(s) });
    s.saveTodos = () => { s.saves++; };
    s.saveTagRegistry = () => { s.tagSaves++; };
    s.syncWithServer = () => {};
    return s;
}

test('The tag cloud merges the registry with task tags, without case duplicates', () => {
    const s = state();
    assert.deepEqual(Array.from(s.allTags), ['home', 'Someday', 'Urgent', 'Work']);
    s.tagRegistry.push('  errands  ');
    assert.equal(s.allTags.filter(tag => tag.toLocaleLowerCase() === 'errands').length, 1);
});

test('Opening the add dialog clears fields and focuses the input', () => {
    const s = state();
    s.addTagName = 'leftover';
    s.addTagError = 'old error';
    s.openTagAddDialog();
    assert.equal(s.tagAddOpen, true);
    assert.equal(s.addTagName, '');
    assert.equal(s.addTagError, '');
    assert.equal(s.inputFocus, 1);
});

test('Adding trims the name, stores it in the registry, and closes the dialog', () => {
    const s = state();
    s.openTagAddDialog();
    s.addTagName = '  Errands  ';
    s.addTagFromDialog();
    assert.deepEqual(Array.from(s.tagRegistry), ['Someday', 'Work', 'Errands']);
    assert.equal(s.tagSaves, 1);
    assert.equal(s.tagAddOpen, false);
    assert.equal(s.addTagName, '');
    assert.equal(s.triggerFocus, 1);
    assert.ok(s.allTags.includes('Errands'));
});

test('Empty and duplicate names are rejected with an error and do not save', () => {
    const s = state();
    s.openTagAddDialog();

    s.addTagName = '   ';
    s.addTagFromDialog();
    assert.match(s.addTagError, /enter a tag name/i);
    assert.equal(s.tagSaves, 0);
    assert.equal(s.tagAddOpen, true, 'dialog stays open for correction');

    // Duplicate of a registry-only tag, different case.
    s.addTagName = 'someday';
    s.addTagFromDialog();
    assert.match(s.addTagError, /already exists/i);
    assert.equal(s.tagSaves, 0);
    assert.equal(s.tagRegistry.length, 2);

    // Duplicate of a tag that only exists on a task.
    s.addTagName = 'HOME';
    s.addTagFromDialog();
    assert.match(s.addTagError, /already exists/i);
    assert.equal(s.tagRegistry.length, 2);
    assert.equal(s.saves, 0);
});

test('Deleting a registry-only tag works and clears its filter', () => {
    const s = state();
    s.activeTag = 'Someday';
    s.requestTagDelete('Someday');
    assert.equal(s.tagDeleteCount, 0);
    s.confirmTagDelete();
    assert.deepEqual(Array.from(s.tagRegistry), ['Work']);
    assert.equal(s.tagSaves, 1);
    assert.equal(s.activeTag, null);
    assert.equal(s.saves, 1);
});

test('Escape closes the add dialog', () => {
    const s = state();
    app.mounted.call(s);
    s.openTagAddDialog();
    keydown({ key: 'Escape' });
    assert.equal(s.tagAddOpen, false);
    assert.equal(s.tagSaves, 0);
});
