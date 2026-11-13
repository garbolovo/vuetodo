const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

let app;
vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'), 'utf8'), {
    window: {},
    Vue: { createApp(options) { app = options; return { mount() {} }; } },
});

function state(overrides = {}) {
    const s = {
        newTodo: { title: '', body: '', startDate: '', dueDate: '', priority: '' },
        selectedItem: { id: 't1', startDate: '', dueDate: '' },
        datePickerQuery: '',
        datePickerIndex: 0,
        quickStartPickerOpen: false,
        quickDuePickerOpen: false,
        startPickerOpen: false,
        duePickerOpen: false,
        quickCustomStartDate: '',
        quickCustomDueDate: '',
        customStartDate: '',
        customDueDate: '',
        saves: 0,
        focuses: 0,
        $nextTick: callback => { if (callback) callback(); },
        $refs: {
            quickDueDateInput: { focus() { s.focuses++; } },
        },
        ...overrides,
    };
    for (const [name, fn] of Object.entries(app.methods)) s[name] = fn.bind(s);
    s.saveTodos = () => { s.saves++; };
    return s;
}

const NOV_8 = new Date(2026, 10, 8);

test('Date picker options include quick dates and the matching clear option', () => {
    const s = state();
    const due = s.datePickerOptions('quick-due');
    const weekdays = [2, 3, 4].map(offset =>
        new Date(s.dateFromToday(offset) + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
    );
    assert.deepEqual(Array.from(due.map(option => option.label)),
        ['Today', 'Tomorrow', ...weekdays, '1 week', 'No due date']);
    assert.equal(due[due.length - 1].value, '');

    const start = s.datePickerOptions('detail-start');
    assert.equal(start[start.length - 1].label, 'No start date');

    s.datePickerQuery = 'tom';
    assert.deepEqual(Array.from(s.datePickerOptions('quick-due').map(option => option.label)),
        ['Tomorrow', 'No due date']);
});

test('Typed dates accept Smart Add syntax, ISO and a bare day number', () => {
    const s = state();
    assert.equal(s.parseDatePickerValue('9', NOV_8), '2026-11-09');
    assert.equal(s.parseDatePickerValue('25jul', NOV_8), '2027-07-25');
    assert.equal(s.parseDatePickerValue('2026-12-01', NOV_8), '2026-12-01');
    assert.equal(s.parseDatePickerValue('today', NOV_8), '2026-11-08');
    assert.equal(s.parseDatePickerValue('31feb', NOV_8), null);
});

test('Arrow keys move through options and Enter applies the date', () => {
    const s = state();
    s.datePickerQuery = '';
    s.datePickerIndex = 0;
    s.datePickerKeydown({ key: 'ArrowDown', preventDefault() {} }, 'quick-due');
    assert.equal(s.datePickerIndex, 1);
    s.datePickerKeydown({ key: 'Enter', preventDefault() {} }, 'quick-due');
    assert.equal(s.newTodo.dueDate, s.dateFromToday(1));
    assert.equal(s.quickDuePickerOpen, false);
    assert.equal(s.saves, 0, 'quick-add date changes are saved when the task is added');
});

test('Typing a date and pressing Enter applies it instead of choosing an option', () => {
    const s = state();
    s.datePickerQuery = '2026-12-15';
    s.datePickerIndex = 0;
    s.datePickerKeydown({ key: 'Enter', preventDefault() {} }, 'quick-start');
    assert.equal(s.newTodo.startDate, '2026-12-15');
    assert.equal(s.quickStartPickerOpen, false);

    s.datePickerQuery = '2027-01-05';
    s.datePickerKeydown({ key: 'Enter', preventDefault() {} }, 'detail-due');
    assert.equal(s.selectedItem.dueDate, '2027-01-05');
    assert.equal(s.duePickerOpen, false);
});

test('Selecting the clear option clears the date and closes the picker', () => {
    const s = state();
    s.newTodo.dueDate = '2026-12-01';
    s.datePickerQuery = 'no due';
    const clearOption = s.datePickerOptions('quick-due').find(option => !option.value);
    s.selectDatePickerOption('quick-due', clearOption);
    assert.equal(s.newTodo.dueDate, '');
    assert.equal(s.quickDuePickerOpen, false);
});

test('Opening a picker resets the query and focuses its input', () => {
    const s = state();
    s.datePickerQuery = 'stale';
    s.datePickerIndex = 3;
    s.prepareDatePicker('quickDueDateInput');
    assert.equal(s.datePickerQuery, '');
    assert.equal(s.datePickerIndex, 0);
    assert.equal(s.focuses, 1);
});
