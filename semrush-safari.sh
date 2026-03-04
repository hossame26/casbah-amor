#!/bin/bash
# Analyse Semrush via Safari (AppleScript navigation + screencapture)
# Utilise la session Safari existante où l'utilisateur est connecté à Semrush

OUTPUT_DIR="/Users/c4b/Desktop/casbah-amor-site/semrush-data/screenshots"
mkdir -p "$OUTPUT_DIR"

# Fonction: naviguer Safari vers une URL et capturer
navigate_and_capture() {
    local url="$1"
    local filename="$2"
    local wait_time="${3:-5}"

    echo "📍 Navigation: $filename"

    # Naviguer Safari
    osascript -e "tell application \"Safari\"
        activate
        tell window 1
            set URL of current tab to \"$url\"
        end tell
    end tell" 2>/dev/null

    # Attendre le chargement
    sleep "$wait_time"

    # Capturer la fenêtre Safari
    osascript -e 'tell application "Safari" to activate' 2>/dev/null
    sleep 0.5
    screencapture -w -o "$OUTPUT_DIR/${filename}.png" 2>/dev/null &
    # -w capture la fenêtre au premier plan, mais nécessite un clic
    # Utilisons plutôt -x (pas de son) et -R pour la zone
    kill $! 2>/dev/null

    # Méthode alternative: capturer le screen entier et crop
    screencapture -x "$OUTPUT_DIR/${filename}.png"
    echo "   ✅ Capturé: ${filename}.png"
}

# Fonction: scroll et capturer
scroll_and_capture() {
    local filename="$1"

    osascript -e 'tell application "System Events"
        tell process "Safari"
            key code 125 using {command down}
        end tell
    end tell' 2>/dev/null
    sleep 2
    screencapture -x "$OUTPUT_DIR/${filename}.png"
    echo "   ✅ Capturé scroll: ${filename}.png"
}

echo "============================================"
echo "🏛️  ANALYSE SEMRUSH - RIADS MARRAKECH"
echo "📅 $(date '+%d/%m/%Y %H:%M')"
echo "============================================"

# PHASE 1: KEYWORD OVERVIEW
echo ""
echo "📊 PHASE 1: KEYWORD OVERVIEW"
echo "---"

keywords=(
    "riad marrakech"
    "riad marrakech avec piscine"
    "riad marrakech pas cher"
    "riad de luxe marrakech"
    "riad marrakech medina"
    "meilleur riad marrakech"
    "location riad marrakech"
    "riad privatif marrakech"
    "riad marrakech rooftop"
    "riad marrakech famille"
    "riad marrakech spa"
    "airbnb riad marrakech"
)

for kw in "${keywords[@]}"; do
    encoded=$(echo "$kw" | sed 's/ /+/g')
    safe=$(echo "$kw" | sed 's/ /_/g')
    navigate_and_capture "https://www.semrush.com/analytics/keywordoverview/?q=${encoded}&db=fr" "kw_${safe}" 5
    sleep 1
done

# PHASE 2: KEYWORD MAGIC TOOL
echo ""
echo "🪄 PHASE 2: KEYWORD MAGIC TOOL"
echo "---"
navigate_and_capture "https://www.semrush.com/analytics/keywordmagic/?q=riad+marrakech&db=fr" "magic_riad_marrakech" 6
scroll_and_capture "magic_riad_marrakech_scroll"

# PHASE 3: ORGANIC RESEARCH - CONCURRENTS
echo ""
echo "🔍 PHASE 3: DOMAINES CONCURRENTS"
echo "---"

domains=(
    "riad-yasmine.com"
    "riadkniza.com"
    "riad-jardin-secret.com"
    "riadfarnatchi.com"
    "riadlaaroussa.com"
    "lamamounia.com"
    "royalmansour.com"
    "riad-72.com"
    "dardarma.com"
    "kasbahamour.com"
)

for domain in "${domains[@]}"; do
    safe=$(echo "$domain" | sed 's/\./_/g')
    # Overview
    navigate_and_capture "https://www.semrush.com/analytics/organic/overview/?db=fr&q=${domain}" "domain_${safe}" 5
    sleep 1
    # Positions
    navigate_and_capture "https://www.semrush.com/analytics/organic/positions/?db=fr&q=${domain}" "positions_${safe}" 5
    sleep 1
done

# PHASE 4: BACKLINKS
echo ""
echo "🔗 PHASE 4: BACKLINKS CONCURRENTS"
echo "---"

for domain in "${domains[@]}"; do
    safe=$(echo "$domain" | sed 's/\./_/g')
    navigate_and_capture "https://www.semrush.com/analytics/backlinks/overview/?q=${domain}" "backlinks_${safe}" 5
    sleep 1
done

# PHASE 5: KEYWORD GAP (top 5)
echo ""
echo "🔀 PHASE 5: KEYWORD GAP"
echo "---"
navigate_and_capture "https://www.semrush.com/analytics/keywordgap/?db=fr&q=riad-yasmine.com&domains[]=riadkniza.com&domains[]=lamamounia.com&domains[]=royalmansour.com&domains[]=riad-72.com" "keyword_gap" 6
scroll_and_capture "keyword_gap_scroll"

echo ""
echo "============================================"
echo "✅ ANALYSE TERMINÉE!"
echo "📁 Screenshots: $OUTPUT_DIR"
echo "📸 $(ls $OUTPUT_DIR/*.png 2>/dev/null | wc -l) captures"
echo "============================================"
