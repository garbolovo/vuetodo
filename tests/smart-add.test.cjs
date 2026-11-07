const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
let uuid = 0;
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: {},
    uuidv4: () => `id-${++uuid}`,
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state(overrides = {}) {
    const s = {
        todoList: [],
        newTodo: { title: '', body: '', startDate: '', dueDate: '', priority: '' },
        quickAddActive: true,
        quickAddSuggestions: [],
        quickAddSuggestionIndex: 0,
        quickAddSuggestionToken: null,
        allTags: ['Work', 'Home'],
        allContexts: ['@computer', '@shop'],
        $refs: {
            quickAddInput: {
                selectionStart: 0,
                focus() {},
                setSelectionRange() {},
            },
        },
        $nextTick: callback => { if (callback) callback(); },
        saves: 0,
        cancels: 0,
        ...overrides,
    };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    s.saveTodos = () => { s.saves++; };
    s.cancelQuickAdd = () => { s.cancels++; };
    return s;
}

const NOV_8 = new Date(2026, 10, 8);

test('Smart Add parses priority, tags, context and both dates', () => {
    const s = state();
    const parsed = s.parseSmartAdd('Buy milk ^25jul2027 #Work !1 @shop ~14jun2027', NOV_8);
    assert.equal(parsed.title, 'Buy milk');
    assert.equal(parsed.priority, 'high');
    assert.deepEqual(Array.from(parsed.tags), ['Work']);
    assert.equal(parsed.context, '@shop');
    assert.equal(parsed.startDate, '2027-06-14');
    assert.equal(parsed.dueDate, '2027-07-25');
});

test('Dates without a year use the next occurrence', () => {
    const s = state();
    assert.equal(s.parseSmartDate('25jul', NOV_8), '2027-07-25');
    assert.equal(s.parseSmartDate('25dec', NOV_8), '2026-12-25');
    assert.equal(s.parseSmartDate('8nov', NOV_8), '2026-11-08');
    assert.equal(s.parseSmartDate('today', NOV_8), '2026-11-08');
    assert.equal(s.parseSmartDate('tomorrow', NOV_8), '2026-11-09');
    assert.equal(s.parseSmartDate('2026-12-31', NOV_8), '2026-12-31');
    assert.equal(s.parseSmartDate('31feb', NOV_8), null);
    assert.equal(s.parseSmartDate('29feb2028', NOV_8), '2028-02-29');
    assert.equal(s.parseSmartDate('29feb2027', NOV_8), null);
});

test('Tags and priority map correctly; duplicates are ignored case-insensitively', () => {
    const s = state();
    const parsed = s.parseSmartAdd('Title #Work #work #Home !2 @Office', NOV_8);
    assert.deepEqual(Array.from(parsed.tags), ['Work', 'Home']);
    assert.equal(parsed.priority, 'medium');
    assert.equal(parsed.context, '@Office');

    assert.equal(s.parseSmartAdd('Low !3', NOV_8).priority, 'low');
});

test('Invalid tokens stay in the title', () => {
    const s = state();
    const parsed = s.parseSmartAdd('Call ^nope # !9 @', NOV_8);
    assert.equal(parsed.title, 'Call ^nope # !9 @');
    assert.equal(parsed.priority, '');
    assert.deepEqual(Array.from(parsed.tags), []);
    assert.equal(parsed.context, '');
});

test('Tokens are stripped and applied when adding a task', () => {
    const s = state();
    s.newTodo.title = 'Buy milk ^25jul2027 #Work !1 @shop';
    s.regTodo();
    assert.equal(s.todoList.length, 1);
    const task = s.todoList[0];
    assert.equal(task.title, 'Buy milk');
    assert.equal(task.priority, 'high');
    assert.deepEqual(Array.from(task.tags), ['Work']);
    assert.equal(task.context, '@shop');
    assert.equal(task.dueDate, '2027-07-25');
    assert.equal(task.startDate, '');
    assert.equal(s.saves, 1);
    assert.equal(s.cancels, 1);
});

test('Manual quick-add fields are kept when no tokens are present', () => {
    const s = state();
    s.newTodo = {
        title: 'Plain task',
        body: 'Details',
        startDate: '2026-12-01',
        dueDate: '2026-12-02',
        priority: 'medium',
    };
    s.regTodo();
    const task = s.todoList[0];
    assert.equal(task.title, 'Plain task');
    assert.equal(task.body, 'Details');
    assert.equal(task.startDate, '2026-12-01');
    assert.equal(task.dueDate, '2026-12-02');
    assert.equal(task.priority, 'medium');
    assert.deepEqual(Array.from(task.tags), []);
    assert.equal(task.context, '');
});

test('A title made only of tokens does not create an empty task', () => {
    const s = state();
    s.newTodo.title = '#Work !1 ^25jul2027 @shop';
    s.regTodo();
    assert.equal(s.todoList.length, 0);
    assert.equal(s.saves, 0);
    assert.equal(s.cancels, 0);
});

function type(s, text) {
    s.newTodo.title = text;
    s.$refs.quickAddInput.selectionStart = text.length;
    s.updateQuickAddSuggestions();
}

test('Typing ! opens priority suggestions, including No Priority', () => {
    const s = state();
    type(s, 'milk !');
    assert.deepEqual(Array.from(s.quickAddSuggestions.map(item => item.label)), ['Priority 1', 'Priority 2', 'Priority 3', 'No Priority']);
    assert.equal(s.quickAddSuggestions[3].insert, '!0');

    s.selectQuickAddSuggestion(s.quickAddSuggestions[3]);
    assert.equal(s.newTodo.title, 'milk !0 ');
    assert.equal(s.parseSmartAdd(s.newTodo.title, NOV_8).priority, '');
});

test('Tag and context suggestions filter by the typed query', () => {
    const s = state();
    type(s, 'buy #Wo');
    assert.deepEqual(Array.from(s.quickAddSuggestions.map(item => item.label)), ['Work']);
    s.selectQuickAddSuggestion(s.quickAddSuggestions[0]);
    assert.equal(s.newTodo.title, 'buy #Work ');

    type(s, 'call @sh');
    assert.deepEqual(Array.from(s.quickAddSuggestions.map(item => item.label)), ['@shop']);
    s.selectQuickAddSuggestion(s.quickAddSuggestions[0]);
    assert.equal(s.newTodo.title, 'call @shop ');
});

test('Date tokens suggest Today, Tomorrow and In a week', () => {
    const s = state();
    type(s, 'task ^');
    assert.deepEqual(Array.from(s.quickAddSuggestions.map(item => item.label)), ['Today', 'Tomorrow', 'In a week']);
    s.selectQuickAddSuggestion(s.quickAddSuggestions[0]);
    assert.equal(s.newTodo.title, 'task ^today ');

    type(s, 'start ~');
    assert.deepEqual(Array.from(s.quickAddSuggestions.map(item => item.label)), ['Today', 'Tomorrow', 'In a week']);
    s.selectQuickAddSuggestion(s.quickAddSuggestions[1]);
    assert.equal(s.newTodo.title, 'start ~tomorrow ');
});

test('Arrow keys move the suggestion and Enter selects it', () => {
    const s = state();
    type(s, 'milk !');
    s.quickAddKeydown({ key: 'ArrowDown', preventDefault() {} });
    assert.equal(s.quickAddSuggestionIndex, 1);
    s.quickAddKeydown({ key: 'Enter', preventDefault() {} });
    assert.equal(s.newTodo.title, 'milk !2 ');
});
