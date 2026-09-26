Vue.createApp({
    data() {
        const stored = localStorage.getItem('todoList');
        const todoList = stored ? JSON.parse(stored) : [];

        return {
            name: "John Doe",
            nameClicked: false,
            todoList,
            num: todoList.length,
            filteredTodoList: [],
            filteredOff: true,
            filteredOn: false,
            selectedId: null,
            activeView: 'all',
        };
    },
    computed: {
        // Flattens todoList into a tree order (parents before their children),
        // with a depth for indentation and hasChildren to show a disclosure arrow.
        // Collapsed branches are skipped entirely.
        visibleTodoList() {
            const childrenOf = parentId => this.todoList.filter(t => t.parentId === parentId);
            const entries = [];
            const walk = (parentId, depth) => {
                childrenOf(parentId).forEach(item => {
                    const hasChildren = childrenOf(item.id).length > 0;
                    entries.push({ item, depth, hasChildren });
                    if (hasChildren && !item.collapsed) {
                        walk(item.id, depth + 1);
                    }
                });
            };
            walk(null, 0);
            return entries;
        },

        // Non-"all" views cut across the hierarchy, so they show a flat
        // matching list rather than the tree.
        viewEntries() {
            let list;
            if (this.activeView === 'today') {
                list = this.todoList.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) === 0);
            } else if (this.activeView === 'overdue') {
                list = this.todoList.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) < 0);
            } else if (this.activeView === 'completed') {
                list = this.todoList.filter(t => t.done);
            } else {
                return this.visibleTodoList;
            }
            return list.map(item => ({ item, depth: 0, hasChildren: false }));
        },

        // While searching, show a flat match list instead of the current view.
        displayEntries() {
            if (this.filteredOn) {
                return this.filteredTodoList.map(item => ({ item, depth: 0, hasChildren: false }));
            }
            return this.viewEntries;
        },

        todayCount() {
            return this.todoList.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) === 0).length;
        },

        overdueCount() {
            return this.todoList.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) < 0).length;
        },

        completedCount() {
            return this.todoList.filter(t => t.done).length;
        },

        allCount() {
            return this.todoList.length;
        },

        selectedItem() {
            return this.todoList.find(t => t.id === this.selectedId) || null;
        },

        selectedSubtasks() {
            if (!this.selectedItem) return [];
            return this.todoList.filter(t => t.parentId === this.selectedItem.id);
        },

        selectedSubtaskProgressPct() {
            if (!this.selectedSubtasks.length) return 0;
            const doneCount = this.selectedSubtasks.filter(t => t.done).length;
            return Math.round((doneCount / this.selectedSubtasks.length) * 100);
        },

        // Ancestor titles from the root down to (not including) the selected task.
        selectedBreadcrumb() {
            if (!this.selectedItem) return [];
            const trail = [];
            let current = this.selectedItem;
            while (current.parentId) {
                const parent = this.todoList.find(t => t.id === current.parentId);
                if (!parent) break;
                trail.unshift(parent.title);
                current = parent;
            }
            return trail;
        },
    },
    methods: {

        changeName() {
            if(!this.nameClicked) {
                this.name = 'Leroy Sane';
                this.nameClicked = !this.nameClicked;
            } else {
                this.name = 'John Doe';
                this.nameClicked = !this.nameClicked;

            }
        },

        saveTodos() {
            localStorage.setItem('todoList', JSON.stringify(this.todoList));
        },

        doneTodo(id) {
            const item = this.todoList.find(t => t.id === id);
            item.done = !item.done;
            this.saveTodos();
        },

        deleteTodo(id) {
            if(confirm('Are you sure ?')) {
                // Deleting a task also removes its subtasks, recursively.
                const idsToRemove = new Set([id]);
                let added = true;
                while (added) {
                    added = false;
                    this.todoList.forEach(t => {
                        if (idsToRemove.has(t.parentId) && !idsToRemove.has(t.id)) {
                            idsToRemove.add(t.id);
                            added = true;
                        }
                    });
                }
                this.todoList = this.todoList.filter(t => !idsToRemove.has(t.id));
                if (idsToRemove.has(this.selectedId)) {
                    this.selectedId = null;
                }
                this.saveTodos();
                this.num = this.todoList.length;
            }
        },

        regTodo(e) {
            let todoItem = {};
            const id = uuidv4();
            let item = e.target.parentElement.children[1].value;
            let body = e.target.parentElement.children[3].value;
            let dueDate = e.target.parentElement.children[5].value;
            let priority = e.target.parentElement.children[7].value;
            e.target.parentElement.children[1].value = '';
            e.target.parentElement.children[3].value = '';
            e.target.parentElement.children[5].value = '';
            e.target.parentElement.children[7].value = '';
            if(item) {
                todoItem.id = id;
                todoItem.title = item;
                todoItem.body = body;
                todoItem.dueDate = dueDate;
                todoItem.priority = priority;
                todoItem.parentId = null;
                todoItem.done = false;
                todoItem.collapsed = false;
                this.todoList.push(todoItem);
                this.saveTodos();
                this.num = this.todoList.length;
            } else {
                alert('Todo title is empty')
            }

        },

        addSubtask(parentId) {
            const title = prompt('Subtask title');
            if(title) {
                this.todoList.push({
                    id: uuidv4(),
                    title,
                    body: '',
                    dueDate: '',
                    priority: '',
                    parentId,
                    done: false,
                    collapsed: false,
                });
                this.saveTodos();
                this.num = this.todoList.length;
            }
        },

        toggleCollapse(id) {
            const item = this.todoList.find(t => t.id === id);
            item.collapsed = !item.collapsed;
        },

        selectTodo(id) {
            this.selectedId = id;
        },

        closeDetail() {
            this.selectedId = null;
        },

        clearDueDate() {
            if (this.selectedItem) {
                this.selectedItem.dueDate = '';
                this.saveTodos();
            }
        },

        setView(view) {
            this.activeView = view;
            this.filteredOn = false;
            this.filteredOff = true;
            const searchInput = document.getElementById('search-todo');
            if (searchInput) searchInput.value = '';
        },

        filterTodo(e) {
            let snippet = e.target.value;
            if(snippet) {
                this.filteredOff = false;
                this.filteredOn = true;
                this.filteredTodoList = this.todoList.filter( todo => todo.title.includes(snippet))
                this.num = this.filteredTodoList.length
            } if(!snippet) {
                this.filteredOff = true;
                this.filteredOn = false;
                this.num = this.todoList.length;
            }
        },

        dueDateDiffDays(dueDate) {
            if (!dueDate) return null;
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(dueDate + 'T00:00:00');
            return Math.round((due - today) / 86400000);
        },

        dueDateInfo(dueDate) {
            const due = new Date(dueDate + 'T00:00:00');
            const diffDays = this.dueDateDiffDays(dueDate);

            if (diffDays < 0) return { label: 'Overdue', cls: 'due-overdue' };
            if (diffDays === 0) return { label: 'Today', cls: 'due-today' };
            if (diffDays === 1) return { label: 'Tomorrow', cls: 'due-soon' };
            if (diffDays <= 6) return { label: due.toLocaleDateString('en-US', { weekday: 'long' }), cls: 'due-soon' };
            return { label: due.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }), cls: 'due-future' };
        },

        dueDateLabel(dueDate) {
            return this.dueDateInfo(dueDate).label;
        },

        dueDateClass(dueDate) {
            return this.dueDateInfo(dueDate).cls;
        },

        priorityLabel(priority) {
            return { high: 'High', medium: 'Medium', low: 'Low' }[priority] || '';
        },

        priorityClass(priority) {
            return priority ? 'priority-' + priority : '';
        },
    }
}).mount('#app');
