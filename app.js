new Vue ({
    el: "#app",
    data: {
        
        name: "John Doe",
        todoList: [ ],

    },
    methods: {
        

        doneTodo(e) {
            console.dir(e.target.parentElement.children[0]);
            e.target.parentElement.children[0].classList.toggle('done');
            e.target.parentElement.children[1].classList.toggle('deleted');
            
        },

        deleteTodo(e) {
            if(confirm('Are are sure ?')){
                // e.target.parentElement.classList.add('deleted')
                e.target.parentElement.remove();
            }
        },

        
        regTodo(e) {
            
            
            let todoItem = {};
            let item = e.target.parentElement.children[1].value;
            let body = e.target.parentElement.children[3].value;
            e.target.parentElement.children[1].value = '';
            e.target.parentElement.children[3].value = '';

            // console.log(item);
            // console.log(body);
            todoItem.title = item;
            todoItem.body = body;
            this.todoList.push(todoItem);
            // console.log(this.todoList);

        },

        editTitle(e) {
            console.dir(e.target)
            
           //1

            // let newItem = prompt('Enter New Content');
            // e.target.textContent = newItem;
                        
                            
            //2
            let newItem = prompt('Enter New Content', e.target.textContent);
            if(newItem) {
                this.todoList.forEach( item => {
                    if(item.title === e.target.textContent) {
                        // e.target.textContent = newItem;
                        item.title = newItem;
                        console.log(item.title)
                        console.log(this.todoList)
    
    
                    } 
                })
            }
        },

        editBody(e) {
            let newItem = prompt('Enter New Content', e.target.textContent);
            if(newItem) {
                this.todoList.forEach( item => {
                    if(item.body === e.target.textContent) {
                        // e.target.textContent = newItem;
                        item.body = newItem;
                        console.log(item.body)
                        console.log(this.todoList)
    
    
                    } 
                })
            }
        },

        filterTodo(e) {
            let snippet = e.target.value;
            if(snippet) {
                this.todoList.forEach( item => {
                   console.log(snippet)
                   console.log(item.title)
                   if(item.title.includes(snippet)) {
                       console.log('contains');
                       
                   }
                })
            }
        }
    }
})
        