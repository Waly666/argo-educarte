import pathlib
import markdown
import weasyprint

path = pathlib.Path('DOCUMENTO_TECNICO_ARQUITECTURA.md')
md = path.read_text(encoding='utf-8')
html = markdown.markdown(md, extensions=['tables', 'fenced_code', 'toc'])
html = (
    '<html><head><meta charset="utf-8"><style>'
    'body{font-family:sans-serif; margin:40px;}'
    'pre{background:#f4f4f4; padding:10px; white-space:pre-wrap;}'
    'table{border-collapse:collapse; width:100%;}'
    'th,td{border:1px solid #bbb; padding:6px; text-align:left;}'
    'code{font-family:monospace; background:#eee; padding:2px 4px;}'
    '</style></head><body>'
    + html +
    '</body></html>'
)
weasyprint.HTML(string=html).write_pdf('DOCUMENTO_TECNICO_ARQUITECTURA.pdf')
print('PDF generado: DOCUMENTO_TECNICO_ARQUITECTURA.pdf')
