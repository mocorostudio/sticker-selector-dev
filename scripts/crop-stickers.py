"""Work/chat launcher. Crop, transparency cleanup and saved-PNG readback checks share the existing JS modules."""
import os, pathlib, shutil, sys
node = os.environ.get('CODEX_PRIMARY_RUNTIME_NODE') or shutil.which('node')
if not node:
    sys.exit('Node.jsがありません。共通処理を実行できないため停止します。別の透過処理で代用しません。')
entry = pathlib.Path(__file__).with_suffix('.mjs')
os.execv(node, [node, str(entry), *sys.argv[1:]])
