// Base URL of the persistence API added in server/. Override by setting
// window.VUETODO_API_BASE before this script runs (e.g. once this is
// deployed, point it at the VPS instead of localhost).
const API_BASE = window.VUETODO_API_BASE || 'http://localhost:3001/api';

Vue.createApp({
    data() {
        const stored = localStorage.getItem('todoList');
        const todoList = stored ? JSON.parse(stored) : [];

        return {
            name: "John Doe",
            nameClicked: false,
            todoList,
            filteredTodoList: [],
            filteredOff: true,
            filteredOn: false,
            selectedId: null,
            activeView: 'all',
            activeContext: null,
            activeTag: null,
            activeProject: null,
            quickAddActive: false,
            newTodo: { title: '', body: '', dueDate: '', priority: '' },
            openMenuId: null,
            menuStyle: {},
            showCompleted: false,
            draggedTaskId: null,
            dragOverTaskId: null,
            moveDialogTaskId: null,
            moveTargetId: null,
            sidebarOpen: true,
        };
    },
    mounted() {
        // Close any open row menu when clicking outside of it.
        document.addEventListener('click', (e) => {
            if (this.openMenuId !== null && !e.target.closest('.row-menu')) {
                this.openMenuId = null;
            }
        });

        this.onGlobalKeydown = (e) => {
            if (e.key === 'Escape' && this.moveDialogTaskId) {
                this.closeMoveDialog();
                return;
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                this.$refs.searchInput.focus();
            }
            if (e.key.toLowerCase() === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                const tag = e.target.tagName;
                const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
                if (!isEditable) {
                    e.preventDefault();
                    this.focusQuickAdd();
                }
            }
        };
        // Capture the event before a focused control or browser integration
        // can consume it. Ctrl+K is kept; Cmd+K is the macOS convention.
        window.addEventListener('keydown', this.onGlobalKeydown, true);

        this.syncWithServer();
    },
    beforeUnmount() {
        window.removeEventListener('keydown', this.onGlobalKeydown, true);
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
            const tagMatches = t => this.activeTag === null || (t.tags && t.tags.includes(this.activeTag));

            if (this.activeView === 'all' && this.activeContext === null && this.activeTag === null) {
                return this.treeEntries;
            }

            let base = this.todoList.filter(t => contextMatches(t) && tagMatches(t));
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
                // "all" with a context filter active: still hide completed
                // tasks by default, same as the tree view does.
                list = this.showCompleted ? base : base.filter(t => !t.done);
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
            return this.todoList.filter(t => !t.done).length;
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

        // Distinct tags already used across all tasks, for the sidebar's
        // tag cloud.
        allTags() {
            const set = new Set();
            this.todoList.forEach(t => (t.tags || []).forEach(tag => set.add(tag)));
            return Array.from(set).sort();
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

        moveDialogTask() {
            return this.todoList.find(t => t.id === this.moveDialogTaskId) || null;
        },

        moveDestinationOptions() {
            if (!this.moveDialogTask) return [];
            const unavailableIds = this.projectDescendantIds(this.moveDialogTask.id);
            return this.todoList
                .filter(t => !unavailableIds.has(t.id))
                .map(t => ({ id: t.id, label: this.taskPath(t) }));
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
            // Best-effort: localStorage above already kept the change safe
            // even if the server is unreachable.
            return fetch(`${API_BASE}/todos`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(this.todoList),
            }).catch((err) => {
                console.warn('Could not save todos to server, kept locally only', err);
            });
        },

        // Pulls the todo list from the server on startup. If the server
        // already has data, it wins (it's the shared copy). If the server
        // is empty but we have a local list (e.g. the first run against a
        // fresh server, or the server was unreachable before), push the
        // local list up instead of overwriting it with nothing.
        async syncWithServer() {
            try {
                const res = await fetch(`${API_BASE}/todos`, { credentials: 'include' });
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const serverTodos = await res.json();
                if (serverTodos.length === 0 && this.todoList.length > 0) {
                    await this.saveTodos();
                } else {
                    this.todoList = serverTodos;
                }
            } catch (err) {
                console.warn('Could not reach server, using local copy', err);
            }
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
            }
        },

        regTodo() {
            const title = this.newTodo.title.trim();
            if (!title) return;

            this.todoList.push({
                id: uuidv4(),
                title,
                body: this.newTodo.body,
                dueDate: this.newTodo.dueDate,
                priority: this.newTodo.priority,
                tags: [],
                context: '',
                parentId: null,
                done: false,
                collapsed: false,
            });
            this.saveTodos();
            this.cancelQuickAdd();
        },

        cancelQuickAdd() {
            this.newTodo = { title: '', body: '', dueDate: '', priority: '' };
            this.quickAddActive = false;
            this.$refs.quickAddInput?.blur();
        },

        async focusQuickAdd() {
            this.quickAddActive = true;
            await this.$nextTick();
            this.$refs.quickAddInput?.focus();
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
            }
        },

        toggleCollapse(id) {
            const item = this.todoList.find(t => t.id === id);
            item.collapsed = !item.collapsed;
        },

        // Positions the dropdown with position:fixed (so it escapes
        // #todo-list-wrapper's overflow:hidden) anchored to the ⋯ button,
        // then flips it above the button when there isn't enough room
        // below, and clamps it horizontally so it never runs off-screen.
        async toggleRowMenu(id, event) {
            if (this.openMenuId === id) {
                this.openMenuId = null;
                return;
            }
            const rect = event.currentTarget.getBoundingClientRect();
            this.menuStyle = {
                position: 'fixed',
                top: (rect.bottom + 4) + 'px',
                left: Math.max(8, rect.right - 150) + 'px',
                visibility: 'hidden',
            };
            this.openMenuId = id;
            await this.$nextTick();
            const dropdown = document.querySelector('.row-menu-dropdown');
            if (!dropdown) return;
            const dh = dropdown.offsetHeight;
            const dw = dropdown.offsetWidth;
            const spaceBelow = window.innerHeight - rect.bottom;
            const openUp = spaceBelow < dh + 8 && rect.top > dh + 8;
            const left = Math.max(8, Math.min(rect.right - dw, window.innerWidth - dw - 8));
            const top = openUp ? (rect.top - dh - 4) : (rect.bottom + 4);
            this.menuStyle = {
                position: 'fixed',
                top: top + 'px',
                left: left + 'px',
                visibility: 'visible',
            };
        },

        taskPath(task) {
            const path = [task.title];
            let current = task;
            while (current.parentId) {
                const parent = this.todoList.find(t => t.id === current.parentId);
                if (!parent) break;
                path.unshift(parent.title);
                current = parent;
            }
            return path.join(' › ');
        },

        canReparent(taskId, newParentId) {
            if (!this.todoList.some(t => t.id === taskId)) return false;
            if (newParentId === null) return true;
            if (!this.todoList.some(t => t.id === newParentId)) return false;
            return !this.projectDescendantIds(taskId).has(newParentId);
        },

        reparentTask(taskId, newParentId) {
            if (!this.canReparent(taskId, newParentId)) return false;
            const task = this.todoList.find(t => t.id === taskId);
            if (task.parentId === newParentId) return true;
            task.parentId = newParentId;
            if (newParentId) {
                const parent = this.todoList.find(t => t.id === newParentId);
                parent.collapsed = false;
            }
            this.saveTodos();
            return true;
        },

        openMoveDialog(id) {
            const task = this.todoList.find(t => t.id === id);
            if (!task) return;
            this.moveDialogTaskId = id;
            this.moveTargetId = task.parentId;
            this.openMenuId = null;
            this.$nextTick(() => this.$refs.moveTargetSelect?.focus());
        },

        closeMoveDialog() {
            this.moveDialogTaskId = null;
            this.moveTargetId = null;
        },

        confirmMove() {
            if (this.moveDialogTask && this.reparentTask(this.moveDialogTask.id, this.moveTargetId)) {
                this.closeMoveDialog();
            }
        },

        startDrag(id, event) {
            this.draggedTaskId = id;
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', id);
        },

        setDragOver(targetId, event) {
            if (!this.draggedTaskId || !this.canReparent(this.draggedTaskId, targetId)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
            this.dragOverTaskId = targetId;
        },

        dropTask(targetId) {
            if (this.draggedTaskId) this.reparentTask(this.draggedTaskId, targetId);
            this.endDrag();
        },

        endDrag() {
            this.draggedTaskId = null;
            this.dragOverTaskId = null;
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
            this.openMoveDialog(id);
        },

        menuDelete(id) {
            this.deleteTodo(id);
            this.openMenuId = null;
        },

        // Flattens the subtree rooted at rootId (or the whole forest when
        // rootId is null) in parent-before-children order, skipping the
        // children of any collapsed item.
        buildTree(rootId) {
            // Completed tasks are hidden from the tree by default; "Show
            // Completed" reveals them again.
            const source = this.showCompleted ? this.todoList : this.todoList.filter(t => !t.done);
            const childrenOf = parentId => source.filter(t => t.parentId === parentId);
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
                const rootItem = source.find(t => t.id === rootId);
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
            this.selectedId = this.selectedId === id ? null : id;
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
            const searchInput = this.$refs.searchInput;
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

        // tag toggles: clicking the active tag again clears the filter.
        setTag(tag) {
            this.activeTag = this.activeTag === tag ? null : tag;
            this.resetSearch();
        },

        tagCount(tag) {
            return this.todoList.filter(t => (t.tags || []).includes(tag)).length;
        },

        onContextChange() {
            if (this.selectedItem.context === '__new__') {
                const ctx = prompt('New context name (e.g. @computer)');
                this.selectedItem.context = ctx && ctx.trim() ? ctx.trim() : '';
            }
            this.saveTodos();
        },

        filterTodo(e) {
            const snippet = e.target.value.trim().toLocaleLowerCase();
            if (snippet) {
                this.filteredOff = false;
                this.filteredOn = true;
                this.filteredTodoList = this.todoList.filter(todo =>
                    todo.title.toLocaleLowerCase().includes(snippet)
                );
            } else {
                this.filteredOff = true;
                this.filteredOn = false;
                this.filteredTodoList = [];
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

        isOverdue(item) {
            return !item.done && this.dueDateDiffDays(item.dueDate) < 0;
        },
    }
}).mount('#app');
