const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: {},
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state() {
    const s = {
        todoList: [{ id: 'a', tags: ['Work'] }, { id: 'b', tags: ['Home', 'work'] }],
        selectedId: 'a', newTagName: '', tagComposerOpen: false,
        startPickerOpen: false, duePickerOpen: false, priorityPickerOpen: false, contextPickerOpen: false,
        saves: 0, searchFocus: 0, triggerFocus: 0,
        $nextTick: async callback => { if (callback) callback(); },
    };
    s.$refs = { tagInput: { focus() { s.searchFocus++; } }, tagTrigger: { focus() { s.triggerFocus++; } } };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    for (const [name, fn] of Object.entries(app.computed)) Object.defineProperty(s, name, { get: () => fn.call(s) });
    s.saveTodos = () => { s.saves++; };
    return s;
}

test('Selected tags remain in searchable options and toggling is case-insensitive', () => {
    const s = state();
    assert.deepEqual(Array.from(s.tagPickerOptions), ['Home', 'Work']);
    s.newTagName = 'WOR';
    assert.deepEqual(Array.from(s.tagPickerOptions), ['Work']);
    s.toggleSelectedTag('work');
    assert.deepEqual(s.selectedItem.tags, []);
    assert.equal(s.newTagName, 'WOR');
    s.toggleSelectedTag('Work');
    assert.deepEqual(s.selectedItem.tags, ['Work']);
    assert.equal(s.searchFocus, 0, 'Checkbox selection must not steal focus from the option');
    assert.equal(s.saves, 2);
});

test('Enter reuses an existing tag regardless of case; a new tag is trimmed', async () => {
    const s = state();
    s.newTagName = ' home ';
    s.addSelectedTag();
    await s.$nextTick();
    assert.deepEqual(s.selectedItem.tags, ['Work', 'Home']);
    s.newTagName = 'HOME';
    s.addSelectedTag();
    assert.equal(s.saves, 1, 'An assigned tag must not be duplicated');
    s.newTagName = '  New tag  ';
    s.addSelectedTag();
    await s.$nextTick();
    assert.deepEqual(s.selectedItem.tags, ['Work', 'Home', 'New tag']);
    assert.equal(s.newTagName, '');
});

test('Opening any property picker closes the others; closing tags restores trigger focus', async () => {
    const s = state();
    for (const open of ['toggleStartPicker', 'toggleDuePicker', 'togglePriorityPicker', 'toggleContextPicker', 'openTagComposer']) {
        s.startPickerOpen = s.duePickerOpen = s.priorityPickerOpen = s.contextPickerOpen = s.tagComposerOpen = true;
        // Toggle methods expect their own picker to start closed.
        const own = { toggleStartPicker: 'startPickerOpen', toggleDuePicker: 'duePickerOpen', togglePriorityPicker: 'priorityPickerOpen', toggleContextPicker: 'contextPickerOpen', openTagComposer: 'tagComposerOpen' }[open];
        s[own] = false;
        await s[open]();
        for (const flag of ['startPickerOpen', 'duePickerOpen', 'priorityPickerOpen', 'contextPickerOpen', 'tagComposerOpen']) assert.equal(s[flag], flag === own);
    }
    s.closeTagPicker();
    assert.equal(s.tagComposerOpen, false);
    assert.equal(s.triggerFocus, 1);
    s.priorityPickerOpen = true;
    s.selectTodo('b');
    assert.equal(s.priorityPickerOpen, false);
    assert.equal(s.selectedId, 'b');
});
