<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Authorisation form</title>
    <link rel="stylesheet" href="css/Style.css">
    <link href='https://unpkg.com/boxicons@2.1.4/css/boxicons.min.css' rel='stylesheet'>
</head>
<body>
    <div class="wrapper">
        <?php 
            if($_COOKIE['user'] ==''): 
        ?>
        <form action="php/login.php" method="post">
                <h1>Login</h1>
            <div class="input-box">
                <input type="text" placeholder="username" name="login" required>
            <i class='bx bxs-user-circle'></i> 
            </div>
            <div class="input-box">
                <input type="password" placeholder="password" name="pass" required> 
            <i class='bx bx-lock' ></i>
            </div>
            <div class="remember">
                <label for=""><input type="checkbox">Remember me</label>
                <a href="#">Forget password</a>
            </div>

            <button type="submit" class="btn">Log in</button>

            <div class="register-link">
                <p>Dont have an account??? <a href="register.php">Register</a></p>
            </div>
        </form>
        <?php
            else: header('location: /lk.php');
        ?>
        <?php 
            endif; 
         ?>
    </div>
</body>
</html>