# ═══════════════════════════════════════════════════════════════════════════
# HISABCHE INSTALLER — the two points where electron-builder lets us act.
#
# Compiled macros, not runtime text: English is the language of this file.
# ═══════════════════════════════════════════════════════════════════════════

# ─── BEFORE ANYTHING ELSE ───────────────────────────────────────────────────
# The app is closed first so nothing in the installation directory is held open.
#
# ⚠️ `Uninstall hisabche.exe` IS ITS OWN IMAGE NAME. Killing `hisabche.exe`
# never touched it — and that is the file with the error:
#
#     Error opening file for writing:
#     …\AppData\Local\Programs\hisabche\Uninstall hisabche.exe
#
# electron-builder retries the PREVIOUS uninstaller itself, but two setups
# started in a row, or an uninstall whose window was closed, can leave this
# process alive into the next installation.
!macro preInit
  nsExec::Exec 'taskkill /f /im "hisabche.exe"'
  nsExec::Exec 'taskkill /f /im "Uninstall hisabche.exe"'
  Sleep 1000
!macroend

# ─── THE FILE THE INSTALLATION WRITES LAST ──────────────────────────────────
# `installApplicationFiles` ends with
#
#     File "/oname=${UNINSTALL_FILENAME}" …
#
# so an uninstaller left read-only, or still open, fails the installation at
# its LAST step — after every application file has been extracted. The person
# is left with a half-installed app and a dialog naming a file they never
# asked about, and «Retry» only repeats the same refusal.
#
# This runs after `initMultiUser`, so `$INSTDIR` is the directory being
# upgraded (and is simply the default on a first install, where the file does
# not exist and nothing below runs):
#
#   · attributes cleared — a read-only flag alone is enough to fail the write;
#   · the file opened for append — if that succeeds it is NOT locked, so it is
#     left untouched and the normal upgrade path still runs the old
#     uninstaller and removes the previous version properly;
#   · if it is locked, the processes are killed and the file is deleted: a
#     refused write here means the installation can never finish, so the old
#     version's files are overwritten by the new ones instead.
!macro customInit
  StrCpy $R9 0
  ${Do}
    SetFileAttributes "$INSTDIR\${UNINSTALL_FILENAME}" NORMAL

    ${If} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
      ClearErrors
      FileOpen $0 "$INSTDIR\${UNINSTALL_FILENAME}" a
      ${IfNot} ${Errors}
        FileClose $0
        ${ExitDo}
      ${EndIf}

      ClearErrors
      Delete "$INSTDIR\${UNINSTALL_FILENAME}"
      ${IfNot} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
        ${ExitDo}
      ${EndIf}
    ${Else}
      ${ExitDo}
    ${EndIf}

    nsExec::Exec 'taskkill /f /im "hisabche.exe"'
    nsExec::Exec 'taskkill /f /im "Uninstall hisabche.exe"'
    Sleep 500
    IntOp $R9 $R9 + 1
  ${LoopWhile} $R9 < 8
!macroend
