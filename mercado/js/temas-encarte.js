/*
 * Temas prontos para montar encarte: escolher um aplica cores e fundo de uma
 * vez so, e continua tudo editavel depois. A tela de IA manda esta mesma
 * lista no prompt, para a IA escolher um tema em vez de inventar cores soltas.
 *
 * Mesmos temas, com os mesmos valores, do TemasEncarte.java do Android.
 */
export const TEMAS_ENCARTE = [
  { chave: 'PADARIA', nome: 'Padaria', corPrimaria: '#8D5A2B', corSecundaria: '#F4E3C1',
    corDestaque: '#D32F2F', fundoSugerido: '#FFF8ED', fonteSugerida: 'serif' },
  { chave: 'FEIRA', nome: 'Feira / Hortifruti', corPrimaria: '#2E7D32', corSecundaria: '#C8E6C9',
    corDestaque: '#F9A825', fundoSugerido: '#F1F8E9', fonteSugerida: 'system' },
  { chave: 'ACOUGUE', nome: 'Açougue', corPrimaria: '#7F0000', corSecundaria: '#FFCDD2',
    corDestaque: '#212121', fundoSugerido: '#FFF3F3', fonteSugerida: 'system' },
  { chave: 'FIM_DE_SEMANA', nome: 'Ofertas de fim de semana', corPrimaria: '#EF6C00', corSecundaria: '#FFE0B2',
    corDestaque: '#D32F2F', fundoSugerido: '#FFF8F0', fonteSugerida: 'system' },
  { chave: 'DIA_DOS_PAIS', nome: 'Dia dos Pais', corPrimaria: '#0D47A1', corSecundaria: '#BBDEFB',
    corDestaque: '#FFC107', fundoSugerido: '#F0F6FF', fonteSugerida: 'system' },
  { chave: 'DIA_DAS_MAES', nome: 'Dia das Mães', corPrimaria: '#AD1457', corSecundaria: '#F8BBD0',
    corDestaque: '#FFFFFF', fundoSugerido: '#FFF0F5', fonteSugerida: 'serif' },
  { chave: 'PASCOA', nome: 'Páscoa', corPrimaria: '#6A1B9A', corSecundaria: '#E1BEE7',
    corDestaque: '#FDD835', fundoSugerido: '#FBF3FF', fonteSugerida: 'system' },
  { chave: 'DIA_DAS_CRIANCAS', nome: 'Dia das Crianças', corPrimaria: '#1E88E5', corSecundaria: '#FFF176',
    corDestaque: '#E53935', fundoSugerido: '#FFFDF0', fonteSugerida: 'system' },
  { chave: 'VOLTA_AS_AULAS', nome: 'Volta às Aulas', corPrimaria: '#00695C', corSecundaria: '#B2DFDB',
    corDestaque: '#FFB300', fundoSugerido: '#F0FBF9', fonteSugerida: 'system' },
  { chave: 'BLACK_FRIDAY', nome: 'Black Friday', corPrimaria: '#000000', corSecundaria: '#424242',
    corDestaque: '#FFEB3B', fundoSugerido: '#111111', fonteSugerida: 'system' },
  { chave: 'NATAL', nome: 'Natal', corPrimaria: '#B71C1C', corSecundaria: '#1B5E20',
    corDestaque: '#FFD54F', fundoSugerido: '#FFF7F0', fonteSugerida: 'serif' },
  { chave: 'ANO_NOVO', nome: 'Ano Novo', corPrimaria: '#212121', corSecundaria: '#FFD700',
    corDestaque: '#FFFFFF', fundoSugerido: '#0D0D0D', fonteSugerida: 'system' }
];

export function temaPorChave(chave) {
  return TEMAS_ENCARTE.find(t => t.chave === chave) || null;
}
