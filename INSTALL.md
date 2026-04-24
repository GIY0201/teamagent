# teamagent 설치 가이드

## 왜 `--plugin-dir`인가?

Claude Code의 로컬 플러그인은 marketplace 등록 없이 `--plugin-dir` 플래그로 직접 로드합니다.
`claude plugin install <url>` 은 marketplace에 등록된 플러그인용이고,
로컬 개발 플러그인은 `--plugin-dir`이 공식 방법입니다.

## 1회성 사용 (테스트)

```bash
claude --plugin-dir "C:/Users/USER/workspace/projects/teamagent"
```

Claude Code가 teamagent 플러그인을 로드한 상태로 시작됩니다.
다음이 활성화됩니다:
- `/teamagent:ticket new "<title>"` — 티켓 생성
- `/teamagent:consult codex|gemini <task>` — 서브에이전트 직접 호출
- `/teamagent:status` — 블랙보드 상태 확인
- `teamagent-orchestration` 스킬 (Claude가 자동 참조)
- `gemini-consult` 서브에이전트
- `evidence-check` hook (tickets done 검증)
- `lifecycle-prune` hook (오래된 sidecar 정리)

## 영구 사용 (alias 등록)

### Windows (PowerShell Profile)

```powershell
# $PROFILE 파일에 추가 (notepad $PROFILE)
function ta { claude --plugin-dir "C:/Users/USER/workspace/projects/teamagent" @args }
```

### Git Bash / MINGW

```bash
# ~/.bashrc 또는 ~/.bash_profile에 추가
alias ta='claude --plugin-dir "C:/Users/USER/workspace/projects/teamagent"'
```

이후 `ta` 또는 `ta -p "프롬프트"` 로 teamagent가 로드된 Claude Code를 시작합니다.

## 업데이트

플러그인 코드가 프로젝트 디렉토리(`C:/Users/USER/workspace/projects/teamagent`)에 있으므로
`git pull` 또는 파일 편집만 하면 다음 `--plugin-dir` 실행 시 자동 반영됩니다.

## 통합 테스트 실행

```bash
cd C:/Users/USER/workspace/projects/teamagent
TEAMAGENT_INTEGRATION=1 npm test
```

## 프로젝트별 사용 (선택)

특정 프로젝트에서만 자동 활성화하려면 해당 프로젝트의 `.claude/settings.json`에:

```json
{
  "pluginDirs": ["C:/Users/USER/workspace/projects/teamagent"]
}
```

> ⚠️ `pluginDirs` 설정 지원 여부는 Claude Code 버전에 따라 다를 수 있습니다.
> 확실한 방법은 `--plugin-dir` 플래그입니다.
