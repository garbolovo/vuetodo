new Vue ({
    el: "#app",
    data: {
        todo: document.querySelector("#todo"),
        todosList: []

    },
    methods: {
        enterTodo(e) {
            if(todo.value) {
                this.todosList.push(todo.value);
                todo.value = '';
                console.log(this.todosList)
            }            else {
                alert('Enter Todo')
            }
        },

        doneTodo(e) {
            console.dir(e.target.parentElement.children[0]);
            e.target.parentElement.children[0].classList.toggle('done');
            
        },

        deleteTodo(e) {
            e.target.parentElement.classList.add('deleted')
        }
     }
});