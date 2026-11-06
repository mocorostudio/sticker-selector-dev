"""Pillow codec/normalizer for the shared JS crop command; no background algorithm here."""
import io, struct, sys
from PIL import Image
mode = sys.argv[1]
raw = sys.stdin.buffer.read()
if mode in ('decode', 'strict-decode'):
    im = Image.open(io.BytesIO(raw))
    if im.format != 'PNG' or getattr(im, 'n_frames', 1) != 1 or im.width * im.height > 16000000:
        raise ValueError('1600万画素以下の静止PNGが必要です')
    if mode == 'strict-decode' and (im.mode != 'RGBA' or im.size != (370, 320)):
        raise ValueError('370x320 RGBAの静止PNGが必要です')
    im = im.convert('RGBA')
    sys.stdout.buffer.write(struct.pack('>II', *im.size) + im.tobytes())
elif mode == 'normalize':
    w, h, dw, dh, x, y = map(int, sys.argv[2:])
    im = Image.frombytes('RGBA', (w, h), raw)
    im = im.resize((dw, dh), Image.Resampling.LANCZOS)
    out = Image.new('RGBA', (370, 320), (0, 0, 0, 0))
    out.paste(im, (x, y))
    buf = io.BytesIO()
    out.save(buf, format='PNG', optimize=False)
    sys.stdout.buffer.write(buf.getvalue())
else:
    raise ValueError('decode / normalize を指定してください')
