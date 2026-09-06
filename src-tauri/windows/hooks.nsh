!macro NSIS_HOOK_PREINSTALL
  ; Study Bible Creator owns this uniquely named sidecar. Stop and delete an old
  ; copy before upgrade/reinstall so NSIS cannot keep a stale engine executable.
  nsExec::Exec 'taskkill /F /IM sbc-engine.exe'
  Sleep 250
  Delete "$INSTDIR\sbc-engine.exe"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  nsExec::Exec 'taskkill /F /IM sbc-engine.exe'
  Sleep 250
!macroend
