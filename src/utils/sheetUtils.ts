import { RehearsalSession, Song, PartType } from '../types';

export const PART_LABELS: Record<PartType, string> = {
  vocal: '보컬',
  guitar1: '리드 기타',
  guitar2: '백킹 기타',
  bass: '베이스',
  drum: '드럼',
  keyboard: '건반',
  notes: '비고',
};

export const PART_KEYS: PartType[] = [
  'vocal',
  'guitar1',
  'guitar2',
  'bass',
  'drum',
  'keyboard',
  'notes',
];

/**
 * Parses date string (e.g. "2026-11-26", "2026년 11월 26일") to comparable timestamp
 */
export function getSessionDateTimestamp(session: RehearsalSession): number {
  if (session.dateKey) {
    const t = Date.parse(session.dateKey);
    if (!isNaN(t)) return t;
  }
  const match = session.dateStr?.match(/(\d{4})[^\d]+(\d{1,2})[^\d]+(\d{1,2})/);
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10)
    ).getTime();
  }
  return session.createdAt || 0;
}

/**
 * Sorts sessions so the latest rehearsal date comes first (descending)
 */
export function sortSessionsDescending(sessions: RehearsalSession[]): RehearsalSession[] {
  return [...sessions].sort((a, b) => getSessionDateTimestamp(b) - getSessionDateTimestamp(a));
}

/**
 * Calculates unique members actually assigned to a part across the current session's songs
 */
export function getAssignedMembersForPart(
  session: RehearsalSession,
  part: PartType
): string[] {
  if (part === 'notes' || !session || !Array.isArray(session.songs)) return [];
  const set = new Set<string>();

  // Only aggregate members who are actually assigned in the current songs
  session.songs.forEach((song) => {
    const list = song[part];
    if (Array.isArray(list)) {
      list.forEach((m) => {
        const trimmed = m.trim();
        if (trimmed) set.add(trimmed);
      });
    }
  });

  return Array.from(set);
}

/**
 * Total unique participants count across all parts
 */
export function getTotalParticipantsCount(session: RehearsalSession): number {
  const set = new Set<string>();
  PART_KEYS.forEach((part) => {
    if (part !== 'notes') {
      getAssignedMembersForPart(session, part).forEach((name) => set.add(name));
    }
  });
  return set.size;
}

/**
 * Generates KakaoTalk formatted text for clipboard sharing
 */
export function generateKakaoNotice(session: RehearsalSession): string {
  const date = session.dateStr || session.dateKey;
  const totalCount = getTotalParticipantsCount(session);
  const songCount = session.songs.length;

  const vocalMembers = getAssignedMembersForPart(session, 'vocal').join(', ') || '(미정)';
  const g1Members = getAssignedMembersForPart(session, 'guitar1').join(', ') || '(미정)';
  const g2Members = getAssignedMembersForPart(session, 'guitar2').join(', ') || '(미정)';
  const bassMembers = getAssignedMembersForPart(session, 'bass').join(', ') || '(미정)';
  const drumMembers = getAssignedMembersForPart(session, 'drum').join(', ') || '(미정)';
  const keysMembers = getAssignedMembersForPart(session, 'keyboard').join(', ') || '(미정)';

  let text = `🎸 [누비밴드 ${date} 합주 선곡 & 파트 배정표] 🥁\n\n`;
  text += `📌 총 ${songCount}곡 / 참여인원 현황 (${totalCount}명)\n`;
  text += `• 보컬: ${vocalMembers}\n`;
  text += `• 리드 기타: ${g1Members}\n`;
  text += `• 백킹 기타: ${g2Members}\n`;
  text += `• 베이스: ${bassMembers}\n`;
  text += `• 드럼: ${drumMembers}\n`;
  text += `• 건반: ${keysMembers}\n\n`;
  text += `━━━━━━━━━━━━━━\n`;
  text += `🎵 곡별 파트 배정\n`;

  session.songs.forEach((song, idx) => {
    text += `${idx + 1}. ${song.title} - ${song.artist}\n`;
    const parts: string[] = [];
    if (song.vocal.length) parts.push(`[보컬] ${song.vocal.join(', ')}`);
    if (song.guitar1.length) parts.push(`[리드 기타] ${song.guitar1.join(', ')}`);
    if (song.guitar2.length) parts.push(`[백킹 기타] ${song.guitar2.join(', ')}`);
    if (song.bass.length) parts.push(`[베이스] ${song.bass.join(', ')}`);
    if (song.drum.length) parts.push(`[드럼] ${song.drum.join(', ')}`);
    if (song.keyboard.length) parts.push(`[건반] ${song.keyboard.join(', ')}`);
    if (song.notes) parts.push(`[비고] ${song.notes}`);

    if (parts.length > 0) {
      text += `   ${parts.join(' | ')}\n`;
    } else {
      text += `   (파트 미배정)\n`;
    }
  });

  text += `━━━━━━━━━━━━━━\n`;
  text += `누비밴드 화이팅! 🎶`;
  return text;
}
