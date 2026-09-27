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
            activeContext: null,
            activeProject: null,
            showAddForm: false,
            openMenuId: null,
        };
    },
    mounted() {
        // Close any open row menu when clicking outside of it.
        document.addEventListener('click', (e) => {
            if (this.openMenuId !== null && !e.target.closest('.row-menu')) {
                this.openMenuId = null;
            }
        });
    },
    computed: {
        // The tree rooted at activeProject (or the whole forest if null),
        // flattened in parent-before-children order with a depth for
        // indentation and hasChildren to show a disclosure arrow. Collapsed
        // branches are skipped entirely.
        treeEntries() {
            return this.buildTree(this.activeProject);
        },

        // Today/Overdue/Completed and an active context filter cut across
        // the hierarchy (a subtask's due date or context is independent of
        // its parent's), so they show a flat matching list instead of a
        // tree. A project selection narrows either mode to that project's
        // own descendants.
        viewEntries() {
            const contextMatches = t => this.activeContext === null
                || (this.activeContext === '' ? !t.context : t.context === this.activeContext);

            if (this.activeView === 'all' && this.activeContext === null) {
                return this.treeEntries;
            }

            let base = this.todoList.filter(contextMatches);
            if (this.activeProject) {
                const ids = this.projectDescendantIds(this.activeProject);
                base = base.filter(t => ids.has(t.id));
            }

            let list;
            if (this.activeView === 'today') {
                list = base.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) === 0);
            } else if (this.activeView === 'overdue') {
                list = base.filter(t => !t.done && this.dueDateDiffDays(t.dueDate) < 0);
            } else if (this.activeView === 'completed') {
                list = base.filter(t => t.done);
            } else {
                list = base;
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

        // Root-level tasks that have subtasks act as "projects" for the
        // sidebar, since the app has no separate project entity.
        projectList() {
            return this.todoList.filter(t => t.parentId === null && this.todoList.some(c => c.parentId === t.id));
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

        // Distinct contexts already used across all tasks, for the filter tabs
        // and the detail panel's context picker.
        allContexts() {
            const set = new Set();
            this.todoList.forEach(t => { if (t.context) set.add(t.context); });
            return Array.from(set).sort();
        },

        noContextCount() {
            return this.todoList.filter(t => !t.context).length;
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
                todoItem.tags = [];
                todoItem.context = '';
                todoItem.parentId = null;
                todoItem.done = false;
                todoItem.collapsed = false;
                this.todoList.push(todoItem);
                this.saveTodos();
                this.num = this.todoList.length;
                this.showAddForm = false;
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
                    tags: [],
                    context: '',
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

        toggleRowMenu(id) {
            this.openMenuId = this.openMenuId === id ? null : id;
        },

        // Reparents a task by title lookup, reusing the existing parentId
        // field (no new data model needed). Refuses to move a task under
        // its own descendant, which would create a cycle.
        moveTask(id) {
            const item = this.todoList.find(t => t.id === id);
            const title = prompt('Move under task titled (leave empty to move to top level):', '');
            if (title === null) return;
            if (title.trim() === '') {
                item.parentId = null;
                this.saveTodos();
                return;
            }
            const target = this.todoList.find(t => t.title === title.trim() && t.id !== id);
            if (!target) {
                alert('No task found with that title');
                return;
            }
            if (this.projectDescendantIds(id).has(target.id)) {
                alert('Cannot move a task under its own subtask');
                return;
            }
            item.parentId = target.id;
            this.saveTodos();
        },

        menuAddSubtask(id) {
            this.addSubtask(id);
            this.openMenuId = null;
        },

        menuEdit(id) {
            this.selectTodo(id);
            this.openMenuId = null;
        },

        menuMove(id) {
            this.moveTask(id);
            this.openMenuId = null;
        },

        menuDelete(id) {
            this.deleteTodo(id);
            this.openMenuId = null;
        },

        // Flattens the subtree rooted at rootId (or the whole forest when
        // rootId is null) in parent-before-children order, skipping the
        // children of any collapsed item.
        buildTree(rootId) {
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

            if (rootId) {
                const rootItem = this.todoList.find(t => t.id === rootId);
                if (!rootItem) return [];
                entries.push({ item: rootItem, depth: 0, hasChildren: childrenOf(rootId).length > 0 });
                if (!rootItem.collapsed) walk(rootId, 1);
            } else {
                walk(null, 0);
            }
            return entries;
        },

        // A project (root task) plus every one of its nested descendants.
        projectDescendantIds(rootId) {
            const ids = new Set([rootId]);
            let added = true;
            while (added) {
                added = false;
                this.todoList.forEach(t => {
                    if (ids.has(t.parentId) && !ids.has(t.id)) {
                        ids.add(t.id);
                        added = true;
                    }
                });
            }
            return ids;
        },

        projectIncompleteCount(rootId) {
            const ids = this.projectDescendantIds(rootId);
            return this.todoList.filter(t => ids.has(t.id) && !t.done).length;
        },

        setProject(id) {
            this.activeProject = this.activeProject === id ? null : id;
            this.resetSearch();
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

        addTag(id) {
            const tag = prompt('Tag name');
            if (tag && tag.trim()) {
                const item = this.todoList.find(t => t.id === id);
                if (!item.tags) item.tags = [];
                if (!item.tags.includes(tag.trim())) {
                    item.tags.push(tag.trim());
                    this.saveTodos();
                }
            }
        },

        removeTag(id, tag) {
            const item = this.todoList.find(t => t.id === id);
            if (item && item.tags) {
                item.tags = item.tags.filter(t => t !== tag);
                this.saveTodos();
            }
        },

        resetSearch() {
            this.filteredOn = false;
            this.filteredOff = true;
            const searchInput = document.getElementById('search-todo');
            if (searchInput) searchInput.value = '';
        },

        setView(view) {
            this.activeView = view;
            this.resetSearch();
        },

        // ctx is null for "all contexts", '' for "no context", or a context string.
        setContext(ctx) {
            this.activeContext = ctx;
            this.resetSearch();
        },

        contextCount(ctx) {
            return this.todoList.filter(t => t.context === ctx).length;
        },

        onContextChange() {
            if (this.selectedItem.context === '__new__') {
                const ctx = prompt('New context name (e.g. @computer)');
                this.selectedItem.context = ctx && ctx.trim() ? ctx.trim() : '';
            }
            this.saveTodos();
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
