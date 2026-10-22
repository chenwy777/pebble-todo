"""Encode recorded Electron frames; only the backdrop and captions are added."""
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
import json, os
ROOT=Path(__file__).resolve().parent.parent
INPUT=ROOT/'test-results'/'demo-frames'
OUTPUT=ROOT/'docs'/'demos'
OUTPUT.mkdir(parents=True,exist_ok=True)
font_paths=[Path(os.environ.get('WINDIR','C:/Windows'))/'Fonts'/'segoeui.ttf',Path('/System/Library/Fonts/Supplemental/Arial.ttf'),Path('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')]
font_path=next((p for p in font_paths if p.exists()),None)
font=ImageFont.truetype(str(font_path),16) if font_path else ImageFont.load_default()
small=ImageFont.truetype(str(font_path),12) if font_path else ImageFont.load_default()
for folder in sorted(INPUT.iterdir()):
    if not folder.is_dir() or not (folder/'frames.json').exists():continue
    data=json.loads((folder/'frames.json').read_text())
    frames=[];durations=[]
    for index,info in enumerate(data['frames']):
        actual=Image.open(folder/info['file']).convert('RGBA')
        canvas=Image.new('RGBA',(560,824),'#e1e9eb')
        draw=ImageDraw.Draw(canvas)
        draw.rectangle((0,0,560,74),fill='#f7f8f8')
        draw.text((24,13),'PEBBLE  /  '+folder.name.replace('-',' ').upper(),font=small,fill='#80888d')
        caption=info['caption']
        # Wrap captions only; every app pixel below is an unaltered captured frame.
        if draw.textlength(caption,font=font)>512:
            words=caption.split();line='';lines=[]
            for word in words:
                if draw.textlength((line+' '+word).strip(),font=font)>512:lines.append(line);line=word
                else:line=(line+' '+word).strip()
            lines.append(line)
            for row,line in enumerate(lines):draw.text((24,32+row*18),line,font=font,fill='#343c42')
        else:draw.text((24,37),caption,font=font,fill='#343c42')
        canvas.alpha_composite(actual,(56+448-actual.width,82))
        draw=ImageDraw.Draw(canvas)
        draw.text((24,801),'Real app interaction · isolated demo data',font=small,fill='#7c898f')
        frames.append(canvas.convert('RGB').quantize(colors=128,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE))
        duration=(data['frames'][index+1]['time']-info['time']) if index+1<len(data['frames']) else 1100
        durations.append(max(30,min(2000,round(duration/10)*10)))
    file=OUTPUT/(folder.name+'.gif')
    frames[0].save(file,save_all=True,append_images=frames[1:],duration=durations,loop=0,optimize=True,disposal=2)
    print(f'{file.name}: {len(frames)} frames, {sum(durations)/1000:.1f}s, {file.stat().st_size/1024:.0f} KB')
