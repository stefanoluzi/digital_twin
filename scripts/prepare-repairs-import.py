"""Read-only XLSX extraction. Produces a review JSON, never writes to PostgreSQL.
Usage: python scripts/prepare-repairs-import.py workbook.xlsx review.json --sector LC1C
Requires openpyxl. Years/areas/concrete required dates must be supplied by reviewer.
"""
import argparse
import json
import re
from pathlib import Path
import openpyxl

MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

def quantity(value):
    if value is None or str(value).strip() == '':
        return None
    if str(value).strip().lower() == 'x':
        return 1
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value == int(value) and 1 <= value <= 1000:
        return int(value)
    if re.fullmatch(r'\d+', str(value).strip()) and 1 <= int(value) <= 1000:
        return int(value)
    raise ValueError(f'Cantidad ambigua: {value}')

def prepare(path, sector):
    workbook = openpyxl.load_workbook(path, data_only=False)
    sheet = workbook['Reparaciones']
    headers = [str(c.value or '') for c in sheet[1]]
    rows, issues = [], []
    for values in sheet.iter_rows(min_row=2):
        if sector and str(values[2].value) != sector:
            continue
        for cell in values[4:]:
            if cell.value is None:
                continue
            try:
                amount = quantity(cell.value)
            except ValueError as error:
                issues.append({'cell': cell.coordinate, 'message': str(error)})
                continue
            header = headers[cell.column - 1].lower()
            month = next((i + 1 for i, name in enumerate(MONTHS) if name in header), None)
            year = re.search(r'\b(20\d{2})\b', header)
            if not month:
                issues.append({'cell': cell.coordinate, 'message': 'Mes no reconocido'})
                continue
            if cell.fill.patternType:
                issues.append({'cell': cell.coordinate, 'message': 'Color presente: requiere validación manual; no se traduce a estado sin evidencia de fechas'})
            rows.append({'idrep': str(values[0].value or ''), 'name': str(values[1].value or ''), 'sector': str(values[2].value or ''), 'trade': str(values[3].value or ''), 'area': None, 'quantity': amount, 'targetMonth': f'{year.group(1)}-{month:02d}-01' if year else None, 'requiredDate': None, 'workshop': 'Taller central', 'notes': f'Legacy {sheet.title}!{cell.coordinate}; mes fuente: {headers[cell.column-1]}. Sin evidencia de estado ni fecha de entrega.'})
    return {'confirmed': False, 'rows': rows}, issues

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source'); parser.add_argument('output'); parser.add_argument('--sector', default='LC1C')
    args = parser.parse_args()
    result, issues = prepare(args.source, args.sector)
    output = Path(args.output)
    if output.exists():
        raise SystemExit('El destino ya existe; elegí otro nombre para preservar la revisión anterior.')
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'requestsToReview': len(result['rows']), 'units': sum(row['quantity'] for row in result['rows']), 'issues': issues}, ensure_ascii=False))
    print('Completar área, años y fechas reales; revisar incidencias antes de marcar confirmed=true. No se importó ningún dato.')
