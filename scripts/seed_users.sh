#!/usr/bin/env bash
# Seed users for each role and verify they can log in
set -e

API="${API:-http://localhost:8001/api/v1}"
echo "Using API: $API"

declare -a USERS=(
  'admin|admin1|adminpass123'
  'researcher|researcher1|researcherpass123'
  'student|student1|studentpass123'
)

# Register each user
echo ""
echo "=== Creating users ==="
for entry in "${USERS[@]}"; do
  IFS='|' read -r role username password <<< "$entry"
  echo "Registering $username (role: $role)..."
  curl -s -X POST "$API/auth/register" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$username\",\"password\":\"$password\",\"role\":\"$role\",\"email\":\"$username@example.com\"}" \
    | python3 -m json.tool 2>/dev/null || echo "  (may already exist)"
done

# Login and verify each user
echo ""
echo "=== Verifying logins ==="
for entry in "${USERS[@]}"; do
  IFS='|' read -r role username password <<< "$entry"
  echo ""
  echo "Login as $username..."
  TOKEN_RESP=$(curl -s -X POST "$API/auth/token" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=$username&password=$password")
  TOKEN=$(echo "$TOKEN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('access_token',''))")
  
  if [ -z "$TOKEN" ]; then
    echo "  FAILED: no token for $username"
    echo "  Response: $TOKEN_RESP"
    continue
  fi

  echo "  Token OK"
  
  ME=$(curl -s "$API/auth/me" -H "Authorization: Bearer $TOKEN")
  echo "  /auth/me: $ME"
done

echo ""
echo "=== Done ==="
