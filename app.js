// console.log(uuidv4());
//DOM Load event
document.addEventListener('DOMContentLoaded', function() {
    // console.log('DOM is ready');
    if(localStorage.getItem('todoList') === null) {
        app.__vue__.todoList = [];
    } else {
        let todoList = JSON.parse(localStorage.getItem('todoList'));
        app.__vue__.todoList = JSON.parse(localStorage.getItem('todoList'));
        console.log(todoList)
    }

});
new Vue ({
    el: "#app",
    data: {
        
        name: "John Doe",
        nameClicked: false,
        todoList: [ ],
        filteredTodoList: [],
        filteredOff: true,
        filteredOn: false,

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

        beforeCreate() {
            alert('Massage from Before Created')
        },

        created() {
            alert('created hook')
        },


        doneTodo(e) {
            console.dir(e.target.parentElement.children[0]);
            e.target.parentElement.children[0].classList.toggle('done');
            e.target.parentElement.children[1].classList.toggle('deleted');
        },

        deleteTodo(e) {

            if(confirm('Are you sure ?')) {
                const todoIndex = this.todoList.findIndex( item => item.id === e.target.attributes[1].nodeValue);
                this.todoList.splice(todoIndex, 1);
                console.log(todoIndex);
                console.log(this.todoList);
                localStorage.setItem('todoList', JSON.stringify(this.todoList));

            }

        },
        
        regTodo(e, arr) {
            let todoItem = {};
            const id = uuidv4();
            let item = e.target.parentElement.children[1].value;
            let body = e.target.parentElement.children[3].value;
            e.target.parentElement.children[1].value = '';
            e.target.parentElement.children[3].value = '';
            if(item) {
                todoItem.id = id;
                todoItem.title = item;
                todoItem.body = body;
                this.todoList.push(todoItem);
                localStorage.setItem('todoList', JSON.stringify(this.todoList));
                // console.log(this.todoList);
            } else {
                alert('Todo title is empty')
            }
            

        },

        editTitle(e) {
            let newItem = prompt('Enter New Content', e.target.textContent);
            if(newItem) {
                this.todoList.forEach( (item, index) => {
                    if(item.id === e.target.attributes[0].nodeValue) {
                        // e.target.textContent = newItem;
                        item.title = newItem;

                    } 
                });
                localStorage.setItem('todoList', JSON.stringify(this.todoList));
            }
        },

        editBody(e) {
            console.dir(e.target);
            let newItem = prompt('Enter New Content', e.target.textContent);
            if(newItem) {
                this.todoList.forEach( item => {
                    if(item.id === e.target.attributes[0].nodeValue) {
                        // e.target.textContent = newItem;
                        item.body = newItem;

                    } 
                });
                localStorage.setItem('todoList', JSON.stringify(this.todoList));

            }
        },

        filterTodo(e) {
            let snippet = e.target.value;
            if(snippet) {
                    // 1
            //     this.todoList.forEach( (item, index) => {
            //        console.log(snippet)
            //        console.log(item.title)
            //        if (item.title.includes(snippet)) {
            //            this.showMe = true
                       
            //        } else  {
            //            this.showMe = false
            //        } 
            //     })
            // } else {
            //     this.showMe = true;

                //2
            this.filteredOff = false;
            this.filteredOn = true;
            this.filteredTodoList  = this.todoList.filter( todo => todo.title.includes(snippet))
            console.log(this.filteredTodoList);


            } if(!snippet) {
                this.filteredOff = true;
                this.filteredOn = false;
            }
        },
    }
})

