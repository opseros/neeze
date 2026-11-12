#!/bin/bash
# API smoke test: sign-in, rate limits, privilege escalation, IDOR, request lifecycle, search.
# Run against a dev server (OTP_DEV_ECHO=true) seeded with SEED_DEMO=true:  BASE=http://localhost:3000 scripts/smoke-test.sh
B=${BASE:-http://localhost:3000}
R=$(printf "%05d" $((RANDOM%100000))); R2=$(printf "%05d" $((RANDOM%100000)))
pass=0; fail=0
check(){ if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (expected $3, got $2)"; fail=$((fail+1)); fi; }
J='content-type: application/json'

# --- OTP sign-in, customer A ---
r=$(curl -gs -X POST $B/api/users/otp/request -H "$J" -d "{\"phone\":\"98765 $R\"}"); codeA=$(echo $r | python3 -c "import sys,json;print(json.load(sys.stdin).get('devCode',''))")
check "otp request returns dev code" "${#codeA}" "6"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/users/otp/request -H "$J" -d "{\"phone\":\"98765$R\"}"); check "otp resend within 60s is rate-limited" "$s" "429"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/users/otp/request -H "$J" -d '{"phone":"12345"}'); check "invalid phone rejected" "$s" "400"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/users/otp/verify -H "$J" -d "{\"phone\":\"98765$R\",\"code\":\"000000\"}"); [ "$codeA" == "000000" ] || check "wrong code rejected" "$s" "400"
s=$(curl -gs -c ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -w "%{http_code}" -X POST $B/api/users/otp/verify -H "$J" -d "{\"phone\":\"98765$R\",\"code\":\"$codeA\",\"name\":\"Asha\"}"); check "correct code signs in" "$s" "200"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/users/otp/verify -H "$J" -d "{\"phone\":\"98765$R\",\"code\":\"$codeA\"}"); check "code cannot be reused" "$s" "400"
me=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA $B/api/users/me | python3 -c "import sys,json;u=json.load(sys.stdin).get('user') or {};print(u.get('phone'),u.get('roles'))"); check "session works (/users/me)" "$me" "+9198765$R ['customer']"

# --- customer B ---
r=$(curl -gs -X POST $B/api/users/otp/request -H "$J" -d "{\"phone\":\"91234$R2\"}"); codeB=$(echo $r | python3 -c "import sys,json;print(json.load(sys.stdin).get('devCode',''))")
curl -gs -c ${TMPDIR:-/tmp}/neeze-ckB -o /dev/null -X POST $B/api/users/otp/verify -H "$J" -d "{\"phone\":\"91234$R2\",\"code\":\"$codeB\",\"name\":\"Bimal\"}"

# --- privilege escalation attempts ---
uidA=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA $B/api/users/me | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['id'])")
curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -X PATCH $B/api/users/$uidA -H "$J" -d '{"roles":["super-admin"]}'
roles=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA $B/api/users/me | python3 -c "import sys,json;print(json.load(sys.stdin)['user']['roles'])"); check "customer cannot make self super-admin" "$roles" "['customer']"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/users -H "$J" -d '{"email":"x@y.z","password":"abcdefgh1","roles":["admin"]}'); check "anonymous cannot create users" "$s" "403"
n=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckB "$B/api/users?limit=50" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalDocs'))"); check "customer B sees only own user record" "$n" "1"
n=$(curl -gs "$B/api/otp-challenges" -o /dev/null -w "%{http_code}"); check "otp hashes not readable" "$n" "403"

# --- request submission ---
pid=$(curl -gs "$B/api/providers?where[name][like]=Electrician&limit=1" | python3 -c "import sys,json;print(json.load(sys.stdin)['docs'][0]['id'])")
lid=$(curl -gs "$B/api/localities?where[slug][equals]=tarapur" | python3 -c "import sys,json;print(json.load(sys.stdin)['docs'][0]['id'])")
KEY=testkey-$(date +%s%N)
body="{\"idempotencyKey\":\"$KEY\",\"kind\":\"service\",\"provider\":$pid,\"locality\":$lid,\"description\":\"Fan not working in bedroom\",\"contactName\":\"Asha\",\"contactPhone\":\"98765$R\",\"address\":\"House 12, private lane\"}"
s=$(curl -gs -o /dev/null -w "%{http_code}" -X POST $B/api/requests/submit -H "$J" -d "$body"); check "anonymous cannot submit request" "$s" "401"
r1=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body"); rid=$(echo $r1 | python3 -c "import sys,json;print(json.load(sys.stdin).get('id'))"); code=$(echo $r1 | python3 -c "import sys,json;print(json.load(sys.stdin).get('code'))")
check "customer submits request" "$(echo $code | cut -c1-3)" "NZ-"
r2=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('id'),d.get('duplicate'))"); check "retry with same key is idempotent (no duplicate)" "$r2" "$rid True"

# --- IDOR: customer B must not see or change A's request ---
s=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckB -o /dev/null -w "%{http_code}" $B/api/requests/$rid); check "customer B cannot read A's request" "$s" "404"
n=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckB "$B/api/requests" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalDocs'))"); check "customer B request list is empty" "$n" "0"
s=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckB -o /dev/null -w "%{http_code}" -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled","statusReason":"x"}'); check "customer B cannot cancel A's request" "$([ $s == 403 -o $s == 404 ] && echo blocked)" "blocked"
s=$(curl -gs -o /dev/null -w "%{http_code}" $B/api/requests/$rid); check "anonymous cannot read request" "$s" "403"

# --- status rules for the owner ---
s=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -w "%{http_code}" -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"completed"}'); check "customer cannot mark completed" "$s" "403"
curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -X PATCH $B/api/requests/$rid -H "$J" -d '{"description":"tampered","customer":999}'
d=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA $B/api/requests/$rid?depth=0 | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['description'], d['customer']==$uidA)"); check "customer cannot edit other fields" "$d" "Fan not working in bedroom True"
s=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -w "%{http_code}" -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled"}'); check "cancel without reason refused" "$s" "400"
st=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled","statusReason":"Plans changed"}' | python3 -c "import sys,json;d=json.load(sys.stdin)['doc'];print(d['status'],len(d['history']))"); check "customer cancels with reason, history recorded" "$st" "cancelled 2"
s=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckA -o /dev/null -w "%{http_code}" -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"submitted"}'); check "cancelled is final" "$s" "403"

# --- provider listings: drafts hidden, staff fields locked ---
n=$(curl -gs "$B/api/providers?where[status][not_equals]=published" | python3 -c "import sys,json;print(json.load(sys.stdin).get('totalDocs'))"); check "public never sees unpublished listings" "$n" "0"
cat_id=$(curl -gs "$B/api/categories?where[slug][equals]=plumber" | python3 -c "import sys,json;print(json.load(sys.stdin)['docs'][0]['id'])")
newp=$(curl -gs -b ${TMPDIR:-/tmp}/neeze-ckB -X POST $B/api/providers -H "$J" -d "{\"name\":\"Bimal Plumbing\",\"type\":\"service-professional\",\"categories\":[$cat_id],\"baseLocality\":$lid,\"phone\":\"91234$R2\",\"status\":\"published\",\"verification\":\"credential\"}" | python3 -c "import sys,json;d=json.load(sys.stdin)['doc'];print(d['status'],d['verification'])"); check "self-onboarded listing forced to pending + unverified" "$newp" "pending-review none"

# --- search ---
n=$(curl -gs "$B/explore?q=taraapur%20electrician" | grep -c "Demo Electrician\|ডেমো ইলেকট্রিশিয়ান"); check "search: misspelt locality + category finds provider" "$([ $n -gt 0 ] && echo yes)" "yes"
n=$(curl -gs -b "NEXT_LOCALE=bn" "$B/explore?q=%E0%A6%AA%E0%A7%8D%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%B0" | grep -c "Demo Plumbing\|ডেমো প্লাম্বিং"); check "search: Bengali query (প্লাম্বার) finds plumber" "$([ $n -gt 0 ] && echo yes)" "yes"

echo "== $pass passed, $fail failed"
