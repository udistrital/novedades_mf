import { addDaysToDate, addDaysToTerm, daysBetween, formatCopWords, numberToWords, periodDays, termToDays } from './format.util';

describe('format.util', () => {
  describe('numberToWords', () => {
    it('convierte el ejemplo de referencia de las actas', () => {
      expect(numberToWords(33_838_900)).toBe('TREINTA Y TRES MILLONES OCHOCIENTOS TREINTA Y OCHO MIL NOVECIENTOS');
    });

    it('aplica el apócope de UNO ante sustantivo', () => {
      expect(numberToWords(21_000)).toBe('VEINTIÚN MIL');
      expect(numberToWords(1_000_000)).toBe('UN MILLÓN');
    });

    it('soporta miles de millones', () => {
      expect(numberToWords(1_451_000_000)).toBe('MIL CUATROCIENTOS CINCUENTA Y UN MILLONES');
    });
  });

  describe('formatCopWords', () => {
    it('agrega PESOS al valor en letras', () => {
      expect(formatCopWords(900)).toBe('NOVECIENTOS PESOS');
    });
  });

  describe('termToDays (regla mes = 30 días)', () => {
    it('convierte meses a días con la regla contable', () => {
      expect(termToDays('NUEVE ( 9 ) MESES')).toBe(270);
    });

    it('suma el grupo de días cuando el plazo es mixto', () => {
      expect(termToDays('NUEVE ( 9 ) MESES Y QUINCE ( 15 ) DÍAS')).toBe(285);
    });

    it('no multiplica por 30 un plazo pactado en días', () => {
      // Contrato 653/2025: PlazoEjecucion 315 con UnidadEjecucion "Dia(s)".
      expect(termToDays('TRESCIENTOS QUINCE ( 315 ) DÍAS')).toBe(315);
    });

    it('devuelve 0 con plazos vacíos o ilegibles', () => {
      expect(termToDays('')).toBe(0);
      expect(termToDays(undefined)).toBe(0);
    });
  });

  describe('addDaysToTerm', () => {
    it('extiende el plazo con la regla mes = 30 días', () => {
      expect(addDaysToTerm('NUEVE ( 9 ) MESES', 30)).toBe('DIEZ ( 10 ) MESES');
      expect(addDaysToTerm('NUEVE ( 9 ) MESES', 15)).toBe('NUEVE ( 9 ) MESES Y QUINCE ( 15 ) DÍAS');
    });

    it('devuelve en meses y días también el plazo pactado en días', () => {
      // Lee los 315 días como días (antes los multiplicaba por 30) y formatea el
      // total en la única unidad con que se le muestra un plazo al usuario.
      expect(addDaysToTerm('TRESCIENTOS QUINCE ( 315 ) DÍAS', 12)).toBe('DIEZ ( 10 ) MESES Y VEINTISIETE ( 27 ) DÍAS');
    });

    it('conserva la parte en días de un plazo mixto', () => {
      // Antes perdía los 15 días del plazo original.
      expect(addDaysToTerm('NUEVE ( 9 ) MESES Y QUINCE ( 15 ) DÍAS', 30))
        .toBe('DIEZ ( 10 ) MESES Y QUINCE ( 15 ) DÍAS');
    });

    // La invariante que faltaba: leer el plazo resultante debe dar exactamente los
    // días de partida más los añadidos. Cualquier divergencia entre las dos lecturas
    // de un plazo la rompe, sea cual sea el formato.
    it('el plazo resultante vale lo que el original más los días añadidos', () => {
      const casos = [
        'NUEVE ( 9 ) MESES',
        'TRESCIENTOS QUINCE ( 315 ) DÍAS',
        'NUEVE ( 9 ) MESES Y QUINCE ( 15 ) DÍAS',
        'UN ( 1 ) MES'
      ];
      for (const plazo of casos) {
        for (const extra of [0, 1, 12, 30, 157]) {
          expect(termToDays(addDaysToTerm(plazo, extra))).toBe(termToDays(plazo) + extra);
        }
      }
    });
  });

  describe('fechas (ADR-013: sin normalización a mediodía ni corrección del día 31)', () => {
    it('suma días cruzando fin de mes de 31 días sin desfase', () => {
      expect(addDaysToDate('2024-01-31', 1)).toBe('2024-02-01');
      expect(addDaysToDate('31/01/2024', 30)).toBe('2024-03-01'); // 2024 es bisiesto
    });

    it('resta días correctamente (fecha de terminación del cedente)', () => {
      expect(addDaysToDate('2024-03-01', -1)).toBe('2024-02-29');
    });

    it('calcula días entre fechas a través de un año bisiesto', () => {
      expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2);
      expect(daysBetween('2023-02-28', '2023-03-01')).toBe(1);
    });
  });

  describe('periodDays (mes = 30 días, ambos extremos incluidos)', () => {
    it('reproduce los períodos de las trazas reales del contrato 653/2025', () => {
      // El backend guarda estos números; el calendario real daría 23 y 46.
      expect(periodDays('2025-02-10', '2025-03-05')).toBe(26);
      expect(periodDays('2025-02-08', '2025-03-26')).toBe(49);
    });

    it('cuenta 1 día cuando inicio y fin son el mismo', () => {
      expect(periodDays('2025-02-10', '2025-02-10')).toBe(1);
    });

    it('acepta dd/mm/yyyy y devuelve null si falta una fecha', () => {
      expect(periodDays('10/02/2025', '05/03/2025')).toBe(26);
      expect(periodDays('2025-02-10', '')).toBeNull();
    });

    it('la suspensión usa esta misma cuenta, no el calendario', () => {
      // Se evaluó contarla en días de calendario (24) y negocio decidió el 2026-08-29
      // mantener la regla del legado: fidelidad con producción y con las actas emitidas.
      expect(periodDays('2025-02-10', '2025-03-05')).toBe(26);
      expect(daysBetween('2025-02-10', '2025-03-05')! + 1).toBe(24);
    });
  });
});
