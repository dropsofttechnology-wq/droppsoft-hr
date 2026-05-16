; Dropsoft HR — installer page: Server vs Client (after install folder, before files)
; Skipped when compiling uninstaller (BUILD_UNINSTALLER) to avoid NSIS warning 6010.
; First app launch reads: %APPDATA%\DropsoftHR\install-pending.cfg
!ifndef BUILD_UNINSTALLER
!include "nsDialogs.nsh"

Var DrosoftHrDialog
Var DrosoftHrChkServer
Var DrosoftHrEdtUrl
Var DrosoftHrLeaveOk
Var /GLOBAL DrosoftHrNsisIsServer
Var /GLOBAL DrosoftHrNsisServerUrl

!macro customPageAfterChangeDir
  Page custom DrosoftHrRolePageCreate DrosoftHrRolePageLeave
!macroend

Function DrosoftHrRolePageCreate
  StrCpy $DrosoftHrLeaveOk ""
  StrCpy $DrosoftHrNsisIsServer "1"
  StrCpy $DrosoftHrNsisServerUrl ""

  nsDialogs::Create 1018
  Pop $DrosoftHrDialog

  ${NSD_CreateLabel} 0 0 100% 28u "How will this computer use Dropsoft HR?$\r$\nChoose before files are installed."
  Pop $0

  ${NSD_CreateCheckbox} 0 36u 100% 14u "This PC is the HR server (database and API for your office)"
  Pop $DrosoftHrChkServer
  ${NSD_Check} $DrosoftHrChkServer

  ${NSD_CreateLabel} 0 58u 100% 28u "If this PC is a client only, uncheck the box and enter your server URL (include port), e.g.$\r$\nhttp://192.168.1.10:32100"
  Pop $0

  ${NSD_CreateText} 0 94u 100% 14u "http://"
  Pop $DrosoftHrEdtUrl

  nsDialogs::Show
FunctionEnd

Function DrosoftHrRolePageLeave
  ${NSD_GetState} $DrosoftHrChkServer $0
  IntCmp $0 1 drosoft_srv drosoft_cli

  drosoft_srv:
    StrCpy $DrosoftHrNsisIsServer "1"
    StrCpy $DrosoftHrNsisServerUrl ""
    StrCpy $DrosoftHrLeaveOk "1"
    Return

  drosoft_cli:
    ${NSD_GetText} $DrosoftHrEdtUrl $1
    StrCmp $1 "" drosoft_empty
    StrCpy $2 $1 7
    StrCmp $2 "http://" drosoft_proto_ok
    StrCpy $2 $1 8
    StrCmp $2 "https://" drosoft_proto_ok
    MessageBox MB_ICONSTOP|MB_OK "Server URL must start with http:// or https://"
    Abort

  drosoft_proto_ok:
    StrCpy $DrosoftHrNsisIsServer "0"
    StrCpy $DrosoftHrNsisServerUrl $1
    StrCpy $DrosoftHrLeaveOk "1"
    Return

  drosoft_empty:
    MessageBox MB_ICONSTOP|MB_OK "Enter the full HR server URL (including port)."
    Abort
FunctionEnd

!macro customInstall
  StrCmp $DrosoftHrLeaveOk "1" drosoft_write drosoft_skip

  drosoft_write:
    SetShellVarContext current
    IfFileExists "$APPDATA\DropsoftHR" +2
      CreateDirectory "$APPDATA\DropsoftHR"

    FileOpen $R9 "$APPDATA\DropsoftHR\install-pending.cfg" w
    IfErrors drosoft_skip
    StrCmp $DrosoftHrNsisIsServer "1" drosoft_w_srv drosoft_w_cli

  drosoft_w_srv:
    FileWrite $R9 "role=server$\r$\n"
    ExecWait 'netsh advfirewall firewall add rule name="Dropsoft HR API" dir=in action=allow protocol=TCP localport=32100 profile=private enable=yes' $0
    Goto drosoft_close

  drosoft_w_cli:
    FileWrite $R9 "role=client$\r$\n"
    FileWrite $R9 "serverUrl=$DrosoftHrNsisServerUrl$\r$\n"

  drosoft_close:
    FileClose $R9

  drosoft_skip:
!macroend

!endif
