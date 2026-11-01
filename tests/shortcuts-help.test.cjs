const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
const document = { activeElement: null, addEventListener() {} };
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    document, localStorage: { getItem: () => null }, clearTimeout, setTimeout,
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state() {
    const s = { ...app.data(), closeFocus: 0, returnFocus: 0, searchFocus: 0, quickAdd: 0 };
    const trigger = { isConnected: true, focus() { s.returnFocus++; document.activeElement = trigger; } };
    const close = { isConnected: true, focus() { s.closeFocus++; document.activeElement = close; } };
    document.activeElement = trigger;
    s.$refs = { shortcutsHelpButton: trigger, shortcutsClose: close, searchInput: { focus() { s.searchFocus++; } } };
    s.$nextTick = callback => { if (callback) callback(); };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    s.syncWithServer = () => {};
    s.focusQuickAdd = () => { s.quickAdd++; };
    app.mounted.call(s);
    return s;
}

function key(overrides = {}) {
    return { key: '?', code: 'Slash', shiftKey: true, ctrlKey: false, metaKey: false, altKey: false,
        target: { tagName: 'BUTTON' }, prevented: false, preventDefault() { this.prevented = true; }, ...overrides };
}

test('Shift+/ opens help, clears pending navigation, and focuses the dialog', () => {
    const s = state(); s.gotoPending = true; s.priorityPickerOpen = true;
    const event = key(); s.onGlobalKeydown(event);
    assert.equal(s.shortcutsHelpOpen, true);
    assert.equal(event.prevented, true);
    assert.equal(s.gotoPending, false);
    assert.equal(s.priorityPickerOpen, false);
    assert.equal(s.closeFocus, 1);
});

test('Help does not intercept question marks typed in an input or open above another dialog', () => {
    const s = state(); s.onGlobalKeydown(key({ target: { tagName: 'INPUT' } }));
    assert.equal(s.shortcutsHelpOpen, false);
    s.moveDialogTaskId = 'a'; s.onGlobalKeydown(key());
    assert.equal(s.shortcutsHelpOpen, false);
});

test('Help contains focus, blocks background actions, and Escape restores the opener', () => {
    const s = state(); s.openShortcutsHelp();
    s.onGlobalKeydown(key({ key: 't', code: 'KeyT', shiftKey: false }));
    s.onGlobalKeydown(key({ key: 'k', code: 'KeyK', ctrlKey: true, shiftKey: false }));
    assert.equal(s.quickAdd, 0); assert.equal(s.searchFocus, 0);
    const tab = key({ key: 'Tab', code: 'Tab' }); s.onGlobalKeydown(tab);
    assert.equal(tab.prevented, true); assert.equal(s.closeFocus, 2);
    s.onGlobalKeydown(key({ key: 'Escape', code: 'Escape', shiftKey: false }));
    assert.equal(s.shortcutsHelpOpen, false); assert.equal(s.returnFocus, 1);
});
