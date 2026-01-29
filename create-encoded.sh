#!/bin/bash
#
# Create a compressed and base64-encoded archive of files/folders,
# targeting under 100k characters.
#
# Usage: ./create-encoded.sh [options] [path1] [path2] ...
#        ./create-encoded.sh --output output.tar.bz2.b64
#
# Default paths (when none specified): src tests pyproject.toml README.md
#

set -e

# Default paths to include
DEFAULT_PATHS=("src" "tests" "test_copilot_api.py" "README.md")

# Parse arguments
PATHS=()
OUTPUT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --output|-o)
            OUTPUT="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [options] [path1] [path2] ..."
            echo ""
            echo "Options:"
            echo "  -o, --output FILE  Output filename (default: project_encoded.txt)"
            echo "  -h, --help         Show this help"
            echo ""
            echo "Default paths: ${DEFAULT_PATHS[*]}"
            echo ""
            echo "Examples:"
            echo "  $0                           # Encode default paths"
            echo "  $0 src                       # Encode only src"
            echo "  $0 -o backup.txt src tests   # Custom output and paths"
            exit 0
            ;;
        *)
            PATHS+=("$1")
            shift
            ;;
    esac
done

# Use default paths if none specified
if [ ${#PATHS[@]} -eq 0 ]; then
    PATHS=("${DEFAULT_PATHS[@]}")
    echo "Using default paths: ${PATHS[*]}"
fi

# Determine output filename
if [ -z "$OUTPUT" ]; then
    OUTPUT="project_encoded.txt"
fi

# Validate paths exist
for PATH_ARG in "${PATHS[@]}"; do
    if [ ! -e "$PATH_ARG" ]; then
        echo "Error: '$PATH_ARG' does not exist"
        exit 1
    fi
done

# Create tar archive using git ls-files (only tracked files), compress, and encode to base64
# This ensures we only include files that are committed to git
git ls-files "${PATHS[@]}" | tar -cjf - -T - | base64 > "$OUTPUT"

CHAR_COUNT=$(wc -c < "$OUTPUT" | tr -d ' ')

echo "Created encoded patch: $OUTPUT"
echo "  Paths included: ${PATHS[*]}"
echo "  Characters: $CHAR_COUNT"
echo "  Status: $([ "$CHAR_COUNT" -lt 100000 ] && echo "✓ Under 100k" || echo "✗ Over 100k")"

if [ "$CHAR_COUNT" -ge 100000 ]; then
    echo ""
    echo "Warning: Output exceeds 100k characters. Consider:"
    echo "  - Using fewer or more specific paths"
    echo "  - Splitting into multiple archives"
    echo ""
    echo "To decode and extract:"
    echo "  base64 -D < $OUTPUT | tar -xjf -"
    exit 1
fi

echo ""
echo "To decode and extract:"
echo "  base64 -D < $OUTPUT | tar -xjf -"
