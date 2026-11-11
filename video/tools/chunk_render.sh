#!/bin/bash
# render EDIT in batches of frames to keep memory down: chunk_render.sh EDIT TOTAL OUTDIR
EDIT=$1; TOTAL=$2; OUT=$3; B=150
for ((s=0; s<TOTAL; s+=B)); do
  e=$((s+B-1)); [ $e -ge $TOTAL ] && e=$((TOTAL-1))
  if [ -f "$OUT/f$(printf %05d $e).png" ]; then continue; fi
  at=$(seq -s, $s $e); tmp=$OUT/_c$s; rm -rf $tmp
  ~/.local/bin/raea render $EDIT --at $at -o $tmp/ > $OUT/_log 2>&1 || { echo "fail $s"; tail -3 $OUT/_log; exit 1; }
  i=0; for f in $(ls $tmp | sort); do mv $tmp/$f $OUT/f$(printf %05d $((s+i))).png; i=$((i+1)); done; rm -rf $tmp
  echo "done $s-$e"
done
echo ALLDONE
