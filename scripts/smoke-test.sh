#!/bin/bash
# API smoke test: email sign-in, mandatory mobile, no duplicate accounts, privilege escalation,
# IDOR, request lifecycle, search.
# Run against a dev server (OTP_DEV_ECHO=true, OTP_PROVIDER=console) seeded with SEED_DEMO=true:
#   BASE=http://localhost:3000 scripts/smoke-test.sh
B=${BASE:-http://localhost:3000}
T=${TMPDIR:-/tmp}
R=$RANDOM$RANDOM
EA="asha$R@example.com"; EB="bimal$R@example.com"
PA="98$(printf '%08d' $((RANDOM*RANDOM % 100000000)))"; PB="97$(printf '%08d' $((RANDOM*RANDOM % 100000000)))"
pass=0; fail=0
check(){ if [ "$2" == "$3" ]; then echo "PASS $1"; pass=$((pass+1)); else echo "FAIL $1 (expected $3, got $2)"; fail=$((fail+1)); fi; }
J='content-type: application/json'
jq_(){ python3 -c "import sys,json;d=json.load(sys.stdin);print($1)" 2>/dev/null; }
code_(){ curl -gs -o /dev/null -w "%{http_code}" "$@"; }

# login <email> <jar> → prints user json
login(){ local c; c=$(curl -gs -X POST $B/auth/email/start -H "$J" -d "{\"email\":\"$1\"}" | jq_ "d.get('devCode','')"); curl -gs -c $2 -X POST $B/auth/email/verify -H "$J" -d "{\"email\":\"$1\",\"code\":\"$c\"}"; }

# --- email sign-in ---
check "invalid email rejected" "$(code_ -X POST $B/auth/email/start -H "$J" -d '{"email":"nope"}')" "400"
c1=$(curl -gs -X POST $B/auth/email/start -H "$J" -d "{\"email\":\"$EA\"}" | jq_ "d.get('devCode','')")
check "email code sent (dev echo)" "${#c1}" "6"
check "resend within 60s is rate-limited" "$(code_ -X POST $B/auth/email/start -H "$J" -d "{\"email\":\"$EA\"}")" "429"
[ "$c1" == "000000" ] || check "wrong code rejected" "$(code_ -X POST $B/auth/email/verify -H "$J" -d "{\"email\":\"$EA\",\"code\":\"000000\"}")" "400"
u=$(curl -gs -c $T/neeze-ckA -X POST $B/auth/email/verify -H "$J" -d "{\"email\":\"$EA\",\"code\":\"$c1\"}")
check "correct code signs in; mobile still needed" "$(echo $u | jq_ "d['user']['needsPhone']")" "True"
uidA=$(echo $u | jq_ "d['user']['id']")
check "code cannot be reused" "$(code_ -X POST $B/auth/email/verify -H "$J" -d "{\"email\":\"$EA\",\"code\":\"$c1\"}")" "400"
check "session works (/auth/me)" "$(curl -gs -b $T/neeze-ckA $B/auth/me | jq_ "d['user']['email']")" "$EA"

# --- mandatory mobile ---
pid=$(curl -gs "$B/api/providers?where[name][like]=Electrician&limit=1" | jq_ "d['docs'][0]['id']")
lid=$(curl -gs "$B/api/localities?where[slug][equals]=tarapur" | jq_ "d['docs'][0]['id']")
KEY=testkey-$(date +%s%N)
body="{\"idempotencyKey\":\"$KEY\",\"kind\":\"service\",\"provider\":$pid,\"locality\":$lid,\"description\":\"Fan not working in bedroom\",\"contactName\":\"Asha\",\"contactPhone\":\"$PA\",\"address\":\"House 12, private lane\"}"
check "request refused until mobile is added" "$(code_ -b $T/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body")" "428"
check "name required with mobile" "$(code_ -b $T/neeze-ckA -X POST $B/auth/phone -H "$J" -d "{\"phone\":\"$PA\"}")" "400"
p=$(curl -gs -b $T/neeze-ckA -X POST $B/auth/phone -H "$J" -d "{\"name\":\"Asha\",\"phone\":\"$PA\"}")
if [ "$(echo $p | jq_ "d.get('needsCode')")" == "True" ]; then
  # PHONE_VERIFICATION=on: confirm by code
  pc=$(echo $p | jq_ "d.get('devCode','')")
  [ "$pc" == "000000" ] || check "wrong mobile code rejected" "$(code_ -b $T/neeze-ckA -X POST $B/auth/phone/verify -H "$J" -d "{\"phone\":\"$PA\",\"code\":\"000000\"}")" "400"
  check "mobile verified" "$(curl -gs -b $T/neeze-ckA -X POST $B/auth/phone/verify -H "$J" -d "{\"phone\":\"$PA\",\"code\":\"$pc\"}" | jq_ "d['user']['phone']")" "+91$PA"
  PHONE_CHECK=on
else
  check "mobile saved straight away (check off)" "$(echo $p | jq_ "d['user']['phone']")" "+91$PA"
  PHONE_CHECK=off
fi

# --- no duplicates ---
check "same email signs in to the same account" "$(sleep 61; login $EA $T/neeze-ckA2 | jq_ "d['user']['id']")" "$uidA"
uidB=$(login $EB $T/neeze-ckB | jq_ "d['user']['id']")
check "another account cannot take the same mobile" "$(code_ -b $T/neeze-ckB -X POST $B/auth/phone -H "$J" -d "{\"name\":\"Bimal\",\"phone\":\"$PA\"}")" "409"
pb=$(curl -gs -b $T/neeze-ckB -X POST $B/auth/phone -H "$J" -d "{\"name\":\"Bimal\",\"phone\":\"$PB\"}" | jq_ "d.get('devCode','')")
[ -n "$pb" ] && curl -gs -o /dev/null -b $T/neeze-ckB -X POST $B/auth/phone/verify -H "$J" -d "{\"phone\":\"$PB\",\"code\":\"$pb\"}"

# --- privilege escalation ---
curl -gs -b $T/neeze-ckA -o /dev/null -X PATCH $B/api/users/$uidA -H "$J" -d '{"roles":["super-admin"]}'
check "customer cannot make self super-admin" "$(curl -gs -b $T/neeze-ckA $B/api/users/$uidA | jq_ "d['roles']")" "['customer']"
curl -gs -b $T/neeze-ckA -o /dev/null -X PATCH $B/api/users/$uidA -H "$J" -d '{"phone":"+919999999999","phoneVerified":true}'
check "customer cannot change their mobile through the open API" "$(curl -gs -b $T/neeze-ckA $B/api/users/$uidA | jq_ "d['phone']")" "+91$PA"
check "anonymous cannot create users" "$(code_ -X POST $B/api/users -H "$J" -d '{"email":"x@y.z","password":"abcdefgh1","roles":["admin"]}')" "403"
check "customer B sees only own user record" "$(curl -gs -b $T/neeze-ckB "$B/api/users?limit=50" | jq_ "d.get('totalDocs')")" "1"
check "one-time code hashes not readable" "$(code_ "$B/api/otp-challenges")" "403"

# --- requests ---
check "anonymous cannot submit request" "$(code_ -X POST $B/api/requests/submit -H "$J" -d "$body")" "401"
r1=$(curl -gs -b $T/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body"); rid=$(echo $r1 | jq_ "d.get('id')")
check "customer submits request" "$(echo $r1 | jq_ "d.get('code','')[:3]")" "NZ-"
check "retry with same key is idempotent" "$(curl -gs -b $T/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body" | jq_ "(d.get('id'), d.get('duplicate'))")" "($rid, True)"
check "customer B cannot read A's request" "$(code_ -b $T/neeze-ckB $B/api/requests/$rid)" "404"
check "customer B request list is empty" "$(curl -gs -b $T/neeze-ckB "$B/api/requests" | jq_ "d.get('totalDocs')")" "0"
s=$(code_ -b $T/neeze-ckB -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled","statusReason":"x"}'); check "customer B cannot cancel A's request" "$([ $s == 403 -o $s == 404 ] && echo blocked)" "blocked"
check "anonymous cannot read request" "$(code_ $B/api/requests/$rid)" "403"
check "customer cannot mark completed" "$(code_ -b $T/neeze-ckA -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"completed"}')" "403"
curl -gs -b $T/neeze-ckA -o /dev/null -X PATCH $B/api/requests/$rid -H "$J" -d '{"description":"tampered","customer":999}'
check "customer cannot edit other fields" "$(curl -gs -b $T/neeze-ckA "$B/api/requests/$rid?depth=0" | jq_ "(d['description'], d['customer']==$uidA)")" "('Fan not working in bedroom', True)"
check "cancel without reason refused" "$(code_ -b $T/neeze-ckA -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled"}')" "400"
check "customer cancels with reason, history recorded" "$(curl -gs -b $T/neeze-ckA -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"cancelled","statusReason":"Plans changed"}' | jq_ "(d['doc']['status'], len(d['doc']['history']))")" "('cancelled', 2)"
check "cancelled is final" "$(code_ -b $T/neeze-ckA -X PATCH $B/api/requests/$rid -H "$J" -d '{"status":"submitted"}')" "403"

# --- listings ---
check "public never sees unpublished listings" "$(curl -gs "$B/api/providers?where[status][not_equals]=published" | jq_ "d.get('totalDocs')")" "0"
cat_id=$(curl -gs "$B/api/categories?where[slug][equals]=plumber" | jq_ "d['docs'][0]['id']")
check "self-onboarded listing forced to pending + unverified" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/providers -H "$J" -d "{\"name\":\"Bimal Plumbing $R\",\"type\":\"service-professional\",\"categories\":[$cat_id],\"baseLocality\":$lid,\"phone\":\"$PB\",\"status\":\"published\",\"verification\":\"credential\"}" | jq_ "(d['doc']['status'], d['doc']['verification'])")" "('pending-review', 'none')"

# --- search ---
n=$(curl -gs "$B/explore?q=taraapur%20electrician" | grep -c "Demo Electrician\|ডেমো ইলেকট্রিশিয়ান"); check "search: misspelt locality + category finds provider" "$([ $n -gt 0 ] && echo yes)" "yes"
n=$(curl -gs -b "NEXT_LOCALE=bn" "$B/explore?q=%E0%A6%AA%E0%A7%8D%E0%A6%B2%E0%A6%BE%E0%A6%AE%E0%A7%8D%E0%A6%AC%E0%A6%BE%E0%A6%B0" | grep -c "Demo Plumbing\|ডেমো প্লাম্বিং"); check "search: Bengali query finds plumber" "$([ $n -gt 0 ] && echo yes)" "yes"


# --- provider side: admin links B as owner of the demo electrician ---
ADMIN_EMAIL=${SMOKE_ADMIN_EMAIL:-admin@neeze.local}; ADMIN_PASSWORD=${SMOKE_ADMIN_PASSWORD:-Neeze-dev-2026!}
TOK=$(curl -gs -X POST $B/api/users/login -H "$J" -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" | jq_ "d.get('token','')")
check "admin can sign in to /admin API" "$([ ${#TOK} -gt 20 ] && echo yes)" "yes"
curl -gs -o /dev/null -X PATCH $B/api/providers/$pid -H "$J" -H "Authorization: JWT $TOK" -d "{\"owners\":[$uidB]}"
KEY2=testkey2-$(date +%s%N)
body2="{\"idempotencyKey\":\"$KEY2\",\"kind\":\"service\",\"provider\":$pid,\"locality\":$lid,\"description\":\"Switchboard sparking\",\"contactName\":\"Asha\",\"contactPhone\":\"$PA\",\"urgency\":\"urgent\"}"
rid2=$(curl -gs -b $T/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "$body2" | jq_ "d.get('id')")
check "owner gets an in-app alert for the new request" "$(curl -gs -b $T/neeze-ckB "$B/api/notifications?where[request][equals]=$rid2" | jq_ "d['docs'][0]['kind']")" "new-request"
check "owner can open the request and see the customer's number" "$(curl -gs -b $T/neeze-ckB "$B/api/requests/$rid2?depth=0" | jq_ "d['contactPhone']")" "+91$PA"
check "owner cannot jump straight to completed" "$(code_ -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"completed"}')" "403"
check "owner marks contacted" "$(code_ -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"contacted"}')" "200"
check "customer is notified of the update" "$(curl -gs -b $T/neeze-ckA "$B/api/notifications?where[request][equals]=$rid2" | jq_ "d['docs'][0]['data']['status']")" "contacted"
check "owner cannot edit the customer's description" "$(curl -gs -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"description":"changed"}' | jq_ "d['doc']['description']")" "Switchboard sparking"
check "owner sends a quote" "$(curl -gs -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"quoted","quoteNote":"Rs 450 incl. parts, today 5pm"}' | jq_ "d['doc']['quoteNote']")" "Rs 450 incl. parts, today 5pm"
check "customer accepts the quote" "$(code_ -b $T/neeze-ckA -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"accepted"}')" "200"
check "owner is notified the customer accepted" "$(curl -gs -b $T/neeze-ckB "$B/api/notifications?where[request][equals]=$rid2&sort=-createdAt" | jq_ "d['docs'][0]['data']['status']")" "accepted"
curl -gs -o /dev/null -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"in-progress"}'
check "owner completes the job" "$(curl -gs -b $T/neeze-ckB -X PATCH $B/api/requests/$rid2 -H "$J" -d '{"status":"completed"}' | jq_ "(d['doc']['status'], len(d['doc']['history']))")" "('completed', 6)"
nB=$(curl -gs -b $T/neeze-ckB "$B/api/notifications?limit=1" | jq_ "d['docs'][0]['id']")
check "customer cannot see the owner's notifications" "$(curl -gs -b $T/neeze-ckA "$B/api/notifications?limit=100&depth=0" | jq_ "all(n['user']==$uidA for n in d['docs'])")" "True"
s=$(code_ -b $T/neeze-ckA -X PATCH $B/api/notifications/$nB -H "$J" -d '{"read":true}'); check "customer cannot mark the owner's notification read" "$([ $s == 403 -o $s == 404 ] && echo blocked)" "blocked"
check "owner can mark own notification read (and can't reassign it)" "$(curl -gs -b $T/neeze-ckB -X PATCH "$B/api/notifications/$nB?depth=0" -H "$J" -d '{"read":true,"user":'$uidA'}' | jq_ "(d['doc']['read'], d['doc']['user']==$uidB)")" "(True, True)"
check "dashboard page loads for the owner" "$(code_ -b $T/neeze-ckB $B/provider)" "200"
check "request page loads for the owner" "$(code_ -b $T/neeze-ckB $B/provider/requests/$rid2)" "200"
check "request page is hidden from non-owners" "$(curl -gs -b $T/neeze-ckA $B/provider/requests/$rid2 | grep -c 'Switchboard sparking')" "0"

# --- verified reviews ---
check "provider owner cannot review their own job" "$(code_ -b $T/neeze-ckB -X POST $B/api/reviews -H "$J" -d "{\"request\":$rid2,\"rating\":5}")" "403"
check "no review on a cancelled request" "$(code_ -b $T/neeze-ckA -X POST $B/api/reviews -H "$J" -d "{\"request\":$rid,\"rating\":1}")" "400"
check "rating must be 1-5" "$(code_ -b $T/neeze-ckA -X POST $B/api/reviews -H "$J" -d "{\"request\":$rid2,\"rating\":9}")" "400"
rc0=$(curl -gs "$B/api/providers/$pid?depth=0" | jq_ "d.get('ratingCount') or 0")
rv=$(curl -gs -b $T/neeze-ckA -X POST $B/api/reviews -H "$J" -d "{\"request\":$rid2,\"rating\":5,\"comment\":\"Came on time and fixed it.\",\"status\":\"hidden\",\"authorName\":\"Fake Name\"}")
rvid=$(echo $rv | jq_ "d['doc']['id']")
check "customer reviews a completed job (public name, published)" "$(echo $rv | jq_ "(d['doc']['authorName'], d['doc']['status'])")" "('Asha', 'published')"
check "only one review per job" "$(code_ -b $T/neeze-ckA -X POST $B/api/reviews -H "$J" -d "{\"request\":$rid2,\"rating\":1}")" "400"
check "public sees the review but not who wrote it" "$(curl -gs "$B/api/reviews/$rvid?depth=0" | jq_ "('customer' in d, d['rating'])")" "(False, 5)"
check "provider rating count goes up by one" "$(curl -gs "$B/api/providers/$pid?depth=0" | jq_ "d['ratingCount']")" "$((rc0+1))"
check "owner is notified of the review" "$(curl -gs -b $T/neeze-ckB "$B/api/notifications?where[kind][equals]=new-review&limit=1" | jq_ "d['docs'][0]['data']['rating']")" "5"
check "customer cannot edit or hide a review via API" "$(code_ -b $T/neeze-ckA -X PATCH $B/api/reviews/$rvid -H "$J" -d '{"rating":1,"status":"hidden"}')" "403"
check "owner replies once" "$(curl -gs -b $T/neeze-ckB -X PATCH "$B/api/reviews/$rvid?depth=0" -H "$J" -d '{"reply":"Thank you!","rating":1}' | jq_ "(d['doc']['reply'], d['doc']['rating'])")" "('Thank you!', 5)"
check "owner cannot reply twice" "$(code_ -b $T/neeze-ckB -X PATCH $B/api/reviews/$rvid -H "$J" -d '{"reply":"again"}')" "400"
check "report accepted" "$(curl -gs -b $T/neeze-ckA -X POST $B/api/reviews/$rvid/report | jq_ "d['ok']")" "True"
check "same person reporting twice counts once" "$(curl -gs -b $T/neeze-ckA -X POST $B/api/reviews/$rvid/report | jq_ "d.get('already')")" "True"
check "account page loads after reviewing" "$(code_ -b $T/neeze-ckA $B/me)" "200"
check "dashboard reviews tab loads" "$(code_ -b $T/neeze-ckB "$B/provider?tab=reviews")" "200"
n=$(curl -gs -b NEXT_LOCALE=en $B/p/$pid | grep -c 'Came on time and fixed it'); check "review shows on the provider page" "$([ $n -gt 0 ] && echo yes)" "yes"
KEY3=testkey3-$(date +%s%N)
check "request type is set by the listing, not the browser" "$(curl -gs -b $T/neeze-ckA -X POST $B/api/requests/submit -H "$J" -d "{\"idempotencyKey\":\"$KEY3\",\"kind\":\"appointment\",\"provider\":$pid,\"locality\":$lid,\"description\":\"Check wiring\",\"contactName\":\"Asha\",\"contactPhone\":\"$PA\"}" | jq_ "d['id']" | xargs -I{} curl -gs -b $T/neeze-ckA "$B/api/requests/{}?depth=0" | jq_ "d['kind']")" "service"

curl -gs -o /dev/null -X PATCH $B/api/providers/$pid -H "$J" -H "Authorization: JWT $TOK" -d '{"owners":[]}'

# --- community ---
EC="chitra$R@example.com"; ED="dipu$R@example.com"; PC="96$(printf '%08d' $((RANDOM*RANDOM % 100000000)))"
uidC=$(login $EC $T/neeze-ckC | jq_ "d['user']['id']")
pc=$(curl -gs -b $T/neeze-ckC -X POST $B/auth/phone -H "$J" -d "{\"name\":\"Chitra Paul\",\"phone\":\"$PC\"}" | jq_ "d.get('devCode','')")
[ -n "$pc" ] && curl -gs -o /dev/null -b $T/neeze-ckC -X POST $B/auth/phone/verify -H "$J" -d "{\"phone\":\"$PC\",\"code\":\"$pc\"}"
login $ED $T/neeze-ckD > /dev/null
ADM=(-H "Authorization: JWT $TOK")
check "guest cannot post" "$(code_ -X POST $B/api/posts -H "$J" -d '{"body":"hello there"}')" "403"
check "no mobile number, no posting" "$(code_ -b $T/neeze-ckD -X POST $B/api/posts -H "$J" -d '{"body":"hello there"}')" "428"
P1TXT="Any good tailor near Tarapur $R?"
p1=$(curl -gs -b $T/neeze-ckA -X POST $B/api/posts -H "$J" -d "{\"body\":\"$P1TXT\",\"topic\":\"question\",\"status\":\"published\",\"helpfulCount\":99}")
pid1=$(echo $p1 | jq_ "d['doc']['id']")
check "first post waits for review (and can't set its own status or counts)" "$(echo $p1 | jq_ "(d['doc']['status'], d['doc']['helpfulCount'])")" "('pending', 0)"
s=$(code_ -b $T/neeze-ckB $B/api/posts/$pid1); check "others cannot read a pending post" "$([ $s == 403 -o $s == 404 ] && echo blocked)" "blocked"
check "pending post not in the public feed" "$(curl -gs $B/community | grep -c "tailor near Tarapur $R")" "0"
check "author sees own pending post on its page" "$(curl -gs -b $T/neeze-ckA $B/community/$pid1 | grep -c "tailor near Tarapur $R" | awk '{print ($1>0)?"yes":"no"}')" "yes"
check "others can't open a pending post page" "$(curl -gs -b $T/neeze-ckB $B/community/$pid1 | grep -c "tailor near Tarapur $R")" "0"
curl -gs -o /dev/null -X PATCH $B/api/posts/$pid1 -H "$J" "${ADM[@]}" -d '{"status":"published"}'
check "moderator approves; author is told" "$(curl -gs -b $T/neeze-ckA "$B/api/notifications?where[kind][equals]=post-approved" | jq_ "d['totalDocs']>0")" "True"
check "approved post appears in the feed" "$(curl -gs $B/community | grep -c "tailor near Tarapur $R" | awk '{print ($1>0)?"yes":"no"}')" "yes"
check "public never sees who wrote it (author id)" "$(curl -gs "$B/api/posts/$pid1?depth=0" | jq_ "'author' in d")" "False"
p2=$(curl -gs -b $T/neeze-ckA -X POST $B/api/posts -H "$J" -d '{"body":"Water supply off in Ambicapatty tomorrow","topic":"announcement"}'); pid2=$(echo $p2 | jq_ "d['doc']['id']")
check "second post goes live straight away" "$(echo $p2 | jq_ "d['doc']['status']")" "published"
check "others cannot edit a post" "$(code_ -b $T/neeze-ckB -X PATCH $B/api/posts/$pid2 -H "$J" -d '{"body":"hacked"}')" "403"
check "author edits own post; counts stay server-side" "$(curl -gs -b $T/neeze-ckA -X PATCH $B/api/posts/$pid2 -H "$J" -d '{"body":"Water supply off in Ambicapatty tomorrow 9-5","helpfulCount":50,"status":"published"}' | jq_ "(d['doc']['body'][-3:], d['doc']['helpfulCount'], bool(d['doc'].get('editedAt')))")" "('9-5', 0, True)"
check "guest cannot comment" "$(code_ -X POST $B/api/comments -H "$J" -d "{\"post\":$pid1,\"body\":\"hi\"}")" "403"
cid=$(curl -gs -b $T/neeze-ckB -X POST $B/api/comments -H "$J" -d "{\"post\":$pid1,\"body\":\"Try Rahman Tailors on Link Road\"}" | jq_ "d['doc']['id']")
check "comment counted on the post" "$(curl -gs "$B/api/posts/$pid1?depth=0" | jq_ "d['commentCount']")" "1"
check "author told about the comment" "$(curl -gs -b $T/neeze-ckA "$B/api/notifications?where[kind][equals]=new-comment" | jq_ "d['totalDocs']>0")" "True"
check "helpful toggles on" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/posts/$pid1/helpful | jq_ "(d['helpful'], d['count'])")" "(True, 1)"
check "helpful toggles off" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/posts/$pid1/helpful | jq_ "(d['helpful'], d['count'])")" "(False, 0)"
check "who marked helpful stays private" "$(curl -gs "$B/api/posts/$pid1?depth=0" | jq_ "'helpfulBy' in d")" "False"
s=$(code_ -b $T/neeze-ckB -X DELETE $B/api/posts/$pid1); check "others cannot delete a post" "$([ $s == 403 -o $s == 404 ] && echo blocked)" "blocked"
check "post page loads" "$(code_ $B/community/$pid1)" "200"
check "rules page loads" "$(code_ $B/community/rules)" "200"
check "write page sends guests to sign in" "$(curl -gs $B/community/new | grep -c 'signin?next=%2Fcommunity%2Fnew' | awk '{print ($1>0)?"yes":"no"}')" "yes"

# reports
check "invalid report reason refused" "$(code_ -b $T/neeze-ckB -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"correction\"}")" "400"
check "guest cannot report" "$(code_ -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"spam\"}")" "401"
check "report accepted" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"spam\",\"note\":\"ad\"}" | jq_ "d['ok']")" "True"
check "same person reporting twice counts once" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"spam\"}" | jq_ "d.get('already')")" "True"
check "reports can't be created through the open API" "$(code_ -b $T/neeze-ckB -X POST $B/api/content-reports -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"spam\"}")" "403"
check "reporter sees only their own reports" "$(curl -gs -b $T/neeze-ckB "$B/api/content-reports?depth=0" | jq_ "all(r['reporter']==$uidB for r in d['docs']) and d['totalDocs']>=1")" "True"
check "author can't see who reported them" "$(curl -gs -b $T/neeze-ckA "$B/api/content-reports?where[targetId][equals]=$pid2" | jq_ "d['totalDocs']")" "0"
curl -gs -o /dev/null -b $T/neeze-ckC -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"abuse\"}"
curl -gs -o /dev/null -X POST $B/api/content-reports/submit -H "$J" "${ADM[@]}" -d "{\"targetType\":\"post\",\"targetId\":$pid2,\"reason\":\"spam\"}"
s=$(code_ "$B/api/posts/$pid2"); check "three reports hide the post" "$([ $s == 403 -o $s == 404 ] && echo hidden)" "hidden"
curl -gs -o /dev/null -X PATCH $B/api/posts/$pid2 -H "$J" "${ADM[@]}" -d '{"status":"removed","moderationNote":"Advertising"}'
check "moderator removes: reporter hears the outcome" "$(curl -gs -b $T/neeze-ckB "$B/api/notifications?where[kind][equals]=report-outcome" | jq_ "d['docs'][0]['data']['outcome']")" "resolved"
check "moderator removes: author is told why" "$(curl -gs -b $T/neeze-ckA "$B/api/notifications?where[kind][equals]=post-removed" | jq_ "d['docs'][0]['data']['note']")" "Advertising"
check "report on a listing accepted" "$(curl -gs -b $T/neeze-ckB -X POST $B/api/content-reports/submit -H "$J" -d "{\"targetType\":\"provider\",\"targetId\":$pid,\"reason\":\"wrong-info\",\"note\":\"Number changed\"}" | jq_ "d['ok']")" "True"

# blocks
curl -gs -o /dev/null -b $T/neeze-ckB -X POST $B/api/users/block -H "$J" -d "{\"postId\":$pid1}"
check "after blocking, the author's posts are gone for that person" "$(curl -gs -b $T/neeze-ckB $B/community | grep -c "tailor near Tarapur $R")" "0"
check "...but still visible to others" "$(curl -gs $B/community | grep -c "tailor near Tarapur $R" | awk '{print ($1>0)?"yes":"no"}')" "yes"
check "block list is private" "$(curl -gs -b $T/neeze-ckA "$B/api/users/$uidB" | jq_ "d.get('errors') is not None or 'blockedUsers' not in d")" "True"
curl -gs -o /dev/null -b $T/neeze-ckB -X POST $B/api/users/block -H "$J" -d "{\"userId\":$uidA,\"unblock\":true}"
check "unblock brings them back" "$(curl -gs -b $T/neeze-ckB $B/community | grep -c "tailor near Tarapur $R" | awk '{print ($1>0)?"yes":"no"}')" "yes"

# restrictions, limits, photos
curl -gs -o /dev/null -X POST $B/api/community-restrictions -H "$J" "${ADM[@]}" -d "{\"user\":$uidC,\"until\":\"$(date -u -d tomorrow +%Y-%m-%dT%H:%M:%SZ)\",\"reason\":\"Cooling off\"}"
check "restricted member cannot post" "$(curl -gs -b $T/neeze-ckC -X POST $B/api/posts -H "$J" -d '{"body":"hello again"}' | jq_ "d['errors'][0]['message']")" "restricted"
check "customers cannot restrict others" "$(code_ -b $T/neeze-ckB -X POST $B/api/community-restrictions -H "$J" -d "{\"user\":$uidA,\"until\":\"2030-01-01T00:00:00Z\",\"reason\":\"x\"}")" "403"
for i in 1 2 3; do curl -gs -o /dev/null -b $T/neeze-ckA -X POST $B/api/posts -H "$J" -d "{\"body\":\"Post number $i today\"}"; done
check "five posts a day, then a pause" "$(code_ -b $T/neeze-ckA -X POST $B/api/posts -H "$J" -d '{"body":"one too many"}')" "429"
python3 -c "import zlib,struct;w=h=8;raw=b''.join(b'\x00'+b'\xff\x80\x00'*w for _ in range(h));c=lambda t,d:struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d));open('$T/neeze-dot.png','wb').write(b'\x89PNG\r\n\x1a\n'+c(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+c(b'IDAT',zlib.compress(raw))+c(b'IEND',b''))"
mid=$(curl -gs -b $T/neeze-ckB -X POST $B/api/media -F "file=@$T/neeze-dot.png" -F '_payload={"alt":"dot"}' | jq_ "d['doc']['id']")
check "member uploads a photo" "$([ -n "$mid" ] && [ "$mid" != "None" ] && echo yes)" "yes"
check "uploader stays private" "$(curl -gs "$B/api/media/$mid" | jq_ "'uploadedBy' in d")" "False"
check "can't attach someone else's photo" "$(code_ -b $T/neeze-ckC -X POST $B/api/comments -H "$J" -d '{}' >/dev/null; code_ -b $T/neeze-ckA -X PATCH $B/api/posts/$pid1 -H "$J" -d "{\"image\":$mid}")" "403"

# --- sign-out ---
curl -gs -b $T/neeze-ckA -c $T/neeze-ckA -o /dev/null -X POST $B/auth/logout
check "sign-out clears session" "$(curl -gs -b $T/neeze-ckA $B/auth/me | jq_ "d['user']")" "None"

# --- languages ---
for L in bn en mni-Mtei mni-Beng; do
  check "home page in $L" "$(curl -gs -b NEXT_LOCALE=$L $B/ | grep -o "<html lang=\"$L\"" | head -1)" "<html lang=\"$L\""
done
check "Meitei Mayek text on the page" "$(curl -gs -b NEXT_LOCALE=mni-Mtei $B/ | grep -c 'ꯁꯤꯜꯆꯔ' | awk '{print ($1>0)?"yes":"no"}')" "yes"
check "Meitei Mayek font served" "$(code_ $B/fonts/noto-sans-meetei-mayek-400.woff2)" "200"
check "unknown language falls back to Bengali" "$(curl -gs -b NEXT_LOCALE=xx $B/ | grep -o '<html lang="bn"' | head -1)" '<html lang="bn"'

echo "== $pass passed, $fail failed"
