# 남은 계획 / Remaining plan

기준일: 2026-10-27 (KST). 마감: **2026-10-31 11:59 PM PDT = 2026-11-01(토) 오후 3:59 KST**.
노릴 부문: Best Use of Gemma (Featured), Best Use of Render (Featured), Best Use of Entire, Best Use of a .tech Domain. 한 출품작은 한 번만 수상할 수 있다.

## 1. Render 배포 (가장 먼저)

### 지금 상태
- Blueprint는 예전 `main`의 `render.yaml`(**`plan: pro plus`, Docker, 유료**)로 만들어졌다.
- `https://the-last-guest.onrender.com/healthz` → 502, 헤더 `x-render-routing: no-deploy` (2026-10-27 확인). 아직 성공한 배포가 없었다.
- 카드 등록 후 1달러가 청구됐다. 카드 확인용 임시 승인일 가능성이 있으나 확인하지 않았다.
- 크레딧 $50. Pro Plus는 공식 가격표 기준 월 $175(하루 약 $5.8)라, 켜 두면 약 8.6일 만에 다 쓴다. 넘으면 카드로 과금될 수 있다.
- 새 `render.yaml`(무료 정적 사이트)은 **`wip/browser-gemma` 브랜치에만** 있다. `main`에는 아직 없다.

### 순서
| # | 할 일 | 누가 | 확인 방법 |
|---|---|---|---|
| R1 | Render 대시보드에서 유료 서비스(`the-last-guest`, Docker, pro plus)의 상태와 요금제 확인 → **일시정지 또는 삭제** | 사용자 | Billing에서 예상 청구액이 늘지 않는지 |
| R2 | Billing에서 크레딧 잔액과 1달러 청구의 정체 확인 (임시 승인인지, 사용료인지) | 사용자 | 인보이스, 카드사 앱 |
| R3 | `wip/browser-gemma` 검토 후 `main`에 병합하고 푸시 | 사용자 확인 → Claude | `git log origin/main` |
| R4 | 정적 사이트 배포. 기존 서비스와 이름이 같아서(`the-last-guest`) Blueprint 동기화가 서비스 종류(Docker → static)를 못 바꿀 수 있다. 그럴 땐 R1에서 서비스를 지운 뒤 동기화하거나, `render.yaml`의 `name`을 바꾼다 (예: `the-last-guest-site`) | 사용자(대시보드) + Claude(`render.yaml`) | 대시보드에 static site로 표시, 요금 Free |
| R5 | 배포 확인: `/`, `/gen/harness.json`, `/gen/answer_cache.json`이 200인지, 메인 화면 → 한·영 플레이 → 엔딩 | Claude | 브라우저로 직접 플레이 |
| R6 | 배포된 사이트에서 브라우저 Gemma 확인: 불러오기 → 직접 입력 질문 → 가드레일 통과 답. 첫 로딩 시간, 답 하나 걸리는 시간 기록 (글에 쓸 숫자) | Claude | 측정값을 `results/`에 저장 |
| R7 | .tech 도메인: hacktoberfest.com/my/promos에서 받기 → Render의 Custom Domain에 추가 → 도메인 DNS에 Render가 알려 주는 레코드 입력 → HTTPS 확인 | 사용자(도메인, DNS) + Claude(확인) | `https://<도메인>`에서 게임이 열리는지 |

### 주의
- 모델 파일(약 3.1GB)은 Hugging Face에서 플레이어 브라우저로 바로 받는다. Render에는 화면과 작은 JSON만 올라간다.
- 브라우저 Gemma는 WebGPU가 되는 브라우저(주로 데스크톱 Chrome)에서만 된다. 안 되면 추천 질문(미리 만든 Gemma E4B 답)과 대본으로 엔딩까지 갈 수 있다.
- 다시 서버에서 모델을 돌리려면 `Dockerfile`을 쓴다. 메모리 약 7.1GB를 써서 8GB보다 큰 유료 요금제가 필요하다.

## 2. 브라우저 Gemma 마무리
- `web/gemma-worker.js`는 jsDelivr `+esm` 빌드에서 `Gemma4ForCausalLM`(텍스트 전용)을 불러온다. 로컬 미리보기에서 다운로드가 진행 중이었고, **답 생성은 아직 확인하지 않았다.**
- 확인할 것: 한국어/영어 답이 나오는지, `<end_of_turn>` 같은 토큰이 섞이지 않는지, 가드레일 재시도와 대체 문구가 동작하는지, 탭을 다시 열면 캐시에서 빨리 뜨는지.

## 3. 측정 보강 (글의 신뢰도)
- 하네스 버전은 판정 모델 없이 단어 검사로만 쟀다. 바꿔 말한 누설은 빠져 있다.
- 선택지: 로컬 판정 모델을 정해서 기준선 2개 + 하네스를 **같은 판정 모델로** 다시 채점하거나, 지금처럼 한계를 글에 그대로 쓴다.
- 직접 채점 40개로 판정 모델 일치율 확인 (사용자 참여 필요).

## 4. 파인튜닝 (결정 필요)
- Tinker 크레딧 소진으로 Best Use of Tinker는 사실상 포기 상태.
- MLX LoRA(Qwen3.5-4B, 데이터 891개)는 준비만 되어 있다. 메모리 부족으로 멈췄다(그때 Gemma가 메모리에 같이 올라가 있었다).
- 남은 시간을 고려하면 **빼는 쪽**이 현실적이다. 넣는다면 Gemma를 내린 상태에서 학습하고, 안 되면 4비트(QLoRA)로 바꾼다.

## 5. DEV 글 (심사 비중 가장 큼)
- 구조 초안: 문제(작은 모델이 남의 기억을 누설한다) → 이야기와 물건 4개 → "모델은 읽고 코드는 검증한다"(사실 그래프, 가드레일, 진행 판정) → 측정값(측정한 것만) → 알려진 한계 → 왜 오픈 모델인가(노트북 오프라인, 브라우저 안에서 실행, 데이터가 기기 밖으로 안 나감) → 데모 링크와 세션 기록.
- 필요 자료: 플레이 영상이나 GIF, 스크린샷, 측정 표, Entire 세션 링크.

## 6. 일정 제안
| 날짜 (KST) | 할 일 |
|---|---|
| 10/27 | 브라우저 Gemma 확인, 이 계획 정리 |
| 10/28 | Render R1–R7, 브라우저 Gemma 속도 측정 |
| 10/29 | DEV 글 초안, 측정 보강 여부 결정 |
| 10/30 | 영상/스크린샷, 디자인 다듬기, 글 수정 |
| 10/31 | 세션 기록 최종 업로드(키·이메일 삭제), 제출. 11/1 오후 3:59 전까지 여유 |

## 7. 제출 직전 체크리스트
- [ ] 공개 저장소에 키, `.env`, 세션 기록, 개인 이메일이 없는지 검사
- [ ] 세션 기록 최종본을 비공개 저장소에 올림 (Tinker 키와 개인 이메일 삭제 후)
- [ ] 유료 Render 서비스가 꺼져 있는지
- [ ] 글의 모든 숫자가 `results/`와 맞는지
- [ ] 태그 `#devchallenge`, `#hf26challenge`
