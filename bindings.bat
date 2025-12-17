@echo off
setlocal enabledelayedexpansion

set "bindings="

if exist .env.local (
    for /f "usebackq tokens=*" %%a in (".env.local") do (
        set "line=%%a"
        echo !line! | findstr /r /c:"^#" >nul
        if errorlevel 1 (
            if not "!line!"=="" (
                for /f "tokens=1,* delims==" %%b in ("!line!") do (
                    set "name=%%b"
                    set "value=%%c"
                    set "value=!value:"=!"
                    set "bindings=!bindings! --binding !name!=!value!"
                )
            )
        )
    )
)

echo !bindings!
