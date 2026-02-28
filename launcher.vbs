Dim ws, shell, python, script, port, logfile, cmd
Set ws = CreateObject("WScript.Shell")
Set shell = CreateObject("WScript.Shell")

python  = ws.ExpandEnvironmentStrings("%CT_PYTHON%")
script  = ws.ExpandEnvironmentStrings("%CT_SCRIPT%")
port    = ws.ExpandEnvironmentStrings("%CT_PORT%")
logfile = ws.ExpandEnvironmentStrings("%CT_LOG%")

' 用 cmd /c 执行，重定向 stdout+stderr 到日志文件
' WindowStyle=0 隐藏窗口，bWaitOnReturn=False 异步
cmd = "cmd /c chcp 65001 >nul && """ & python & """ """ & script & """ " & port & " >> """ & logfile & """ 2>&1"
ws.Run cmd, 0, False
