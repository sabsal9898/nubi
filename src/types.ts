export type PartType = 
  | 'vocal'
  | 'guitar1'
  | 'guitar2'
  | 'bass'
  | 'drum'
  | 'keyboard'
  | 'notes';

export interface Song {
  id: string;
  title: string;
  artist: string;
  vocal: string[];
  guitar1: string[];
  guitar2: string[];
  bass: string[];
  drum: string[];
  keyboard: string[];
  notes: string;
  parts?: {
    vocal?: string[];
    leadGuitar?: string[];
    rhythmGuitar?: string[];
    guitar1?: string[];
    guitar2?: string[];
    bass?: string[];
    drum?: string[];
    keyboard?: string[];
  };
}

export interface RehearsalSession {
  id: string;
  dateStr: string; // e.g. "2026년 7월 30일"
  dateKey: string; // e.g. "2026-07-30"
  date?: string; // alias for compatibility
  sheetTitle: string; // "누비 밴드 파트 배분" or "누비 밴드 7월 합주 선곡 & 기악 배정현황"
  songs: Song[];
  extraMembers?: Partial<Record<PartType, string[]>>;
  createdAt: number;
  updatedAt?: number;
}

export interface ColumnDef {
  key: PartType | 'song';
  label: string;
  headerBg: string;
  width: string;
  align: 'left' | 'center' | 'right';
}
