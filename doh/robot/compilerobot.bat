setlocal
set JDK15_HOME=C:\Program Files\IBM\Java60
del DOHRobot*.class
del DOHRemoteRobot*.class
"%JDK15_HOME%\bin\javac" -source 1.5 -target 1.5 -classpath ".;%JDK15_HOME%\jre\lib\plugin.jar" DOHRobot.java
del DOHRobot.jar
"%JDK15_HOME%\bin\jar" cvf DOHRobot.jar DOHRobot*.class DOHRemoteRobot*.class
"%JDK15_HOME%\bin\jarsigner" -keystore ./dohrobot DOHRobot.jar dojo <key
del DOHRobot*.class
del DOHRemoteRobot*.class
endlocal
pause
