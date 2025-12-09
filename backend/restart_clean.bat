@echo off
echo Clearing Python cache...
cd /d "%~dp0"

REM Delete all __pycache__ directories
for /d /r . %%d in (__pycache__) do @if exist "%%d" rd /s /q "%%d"

REM Delete all .pyc files
del /s /q *.pyc 2>nul

echo Cache cleared!
echo Starting backend...
python app.py
