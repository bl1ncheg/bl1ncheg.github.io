<?php
$login = filter_var(trim($_POST['login']),
FILTER_SANITIZE_STRING);
$pass = filter_var(trim($_POST['pass']),
FILTER_SANITIZE_STRING);

    $pass = md5($pass."aboba322");
    $mysql = new mysqli('localhost','root','root','users');

    $result = $mysql -> query("SELECT * FROM `users` WHERE `login` ='$login' AND `pass` = '$pass'");
    
    $user = $result->fetch_assoc();
    if(count($user) == 0){
      echo "Пользователь не найден";
      exit();
    }

    setcookie('user',$user['login'], time() + 3600, "/");

    $mysql->close();

    header('location: /');

?>