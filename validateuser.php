<?php
session_start();
include_once("connect.php");

//Get questionnare results - NEED TO ADD IN WHAT TYPE THEY ARE: strval, intval, floatval ....
$emailadd = strval($_GET['emailadd']);
$_SESSION["username"] = strval($_GET['username']);

//Generate SQL for results insert
$sql="SELECT CASE WHEN '".$emailadd."' IN "
		."(SELECT DISTINCT `emailadd` "
			."FROM `teamr1415`.`User`) THEN 'exists' "
				."ELSE 'newuser' END AS `userstatus`, "
				."CASE WHEN '".$emailadd."' IN "
					."(SELECT DISTINCT `emailadd` "
						."FROM `teamr1415`.`User`) THEN (SELECT `uid` FROM `teamr1415`.`User` WHERE emailadd = '".$emailadd."') "
					."ELSE 0 END AS `uid`;";

$result = mysqli_query($conn,$sql);
$row = mysqli_fetch_array($result);

//update session variables
$_SESSION["uid"] = $row['uid'];
$_SESSION["userstatus"] = $row['userstatus'];

if ($_SESSION["userstatus"] == "newuser") {
	//insert a new user to the user table
	$sql="INSERT INTO `teamr1415`.`User` (`uid`, `username`, `emailadd`) VALUES (NULL, '"
		.$_SESSION["username"]."', '".$emailadd."');";
	mysqli_query($conn,$sql);
	// get the new user's uid
	$sql="SELECT `uid` FROM `User` WHERE `emailadd` = '".$emailadd."'";
	$result = mysqli_query($conn,$sql);
	$row = mysqli_fetch_array($result);
	$_SESSION["uid"] = $row['uid'];
}
//Insert data into GameSessions table and create a new key for the session
$sql="INSERT INTO `teamr1415`.`GameSessions` (`uid`, `starttime`) VALUES ('"
	.$_SESSION["uid"]."', CURRENT_TIMESTAMP);";
mysqli_query($conn,$sql);
//Get the new session key for this user and set set as session variable(sid)
$sql="SELECT MAX(`starttime`) AS `starttime`, `sid` FROM `teamr1415`.`GameSessions` WHERE `uid` = '"
	.$_SESSION["uid"]."' GROUP BY `sid`, '".$_SESSION["uid"]."';";
$result = mysqli_query($conn,$sql);
$row = mysqli_fetch_array($result);
$_SESSION["sid"] = $row['sid'];

//send userstatus back for conditional redirect
echo $_SESSION["userstatus"];
mysqli_close($conn);
?>