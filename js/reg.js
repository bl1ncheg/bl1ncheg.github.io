let email = document.querySelector('#name');
let username = document.querySelector('#username');
let password = document.querySelector('#password');
let submit = document.querySelector('#submit');

let users = {};

function User(email, username, password){
    this.email = email;
    this.username = username;
    this.password = password;
}

function createId(users){
    return Object.keys(users).length;
}

submit.addEventListener('click', () => {
    const emailUser = email.value;
    const usernameUser = username.value;
    const passwordUser = password.value;

    const user = new User(emailUser, usernameUser, passwordUser);

    const userId = 'User' + createId(users);
    users[userId] = user;

    console.log(users);
})