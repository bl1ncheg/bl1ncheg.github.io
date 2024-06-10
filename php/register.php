<?php
$login = filter_var(trim($_POST['login']),
FILTER_SANITIZE_STRING);
$email = filter_var(trim($_POST['email']),
FILTER_SANITIZE_STRING);
$pass = filter_var(trim($_POST['pass']),
FILTER_SANITIZE_STRING);
if(mb_strlen($login) < 5 || mb_strlen($login) > 90){
  echo "Динаху";
  exit();
} else if(mb_strlen($email) < 5 || mb_strlen($email) > 100){
  echo "Динаху";
  exit();
  } else if(mb_strlen($pass) < 5 || mb_strlen($pass) > 90){
    echo "Динаху";
    exit();
    }
    $pass = md5($pass."aboba322");
    $mysql = new mysqli('localhost','root','root','users');
    $mysql->query("INSERT INTO `users`(`login`, `pass`, `email`) VALUES('$login','$pass','$email')");

    $mysql->close();

    header('location: /login.php');

?>