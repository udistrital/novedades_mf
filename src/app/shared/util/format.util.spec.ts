import { addDaysToDate, addDaysToTerm, daysBetween, formatCopWords, numberToWords, termToDays } from './format.util';

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
});
