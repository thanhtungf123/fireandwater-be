/**
 * Seed data for the 7 official Lửa và Nước games.
 * GAME_IDs taken from gamedistribution.com embed codes (docs/Fireboy and watergirl 1.docx).
 * iframeUrl is the base embed; gd_sdk_referrer_url is appended at render time.
 */
export interface GameSeed {
  name: string;
  slug: string;
  gameId: string;
  frameWidth: number;
  frameHeight: number;
  order: number;
  /** Optional thumbnail override when the default .jpeg path isn't available. */
  thumbnail?: string;
}

const GD = "https://html5.gamedistribution.com";
const IMG = "https://img.gamedistribution.com";

export const GAME_SEEDS: GameSeed[] = [
  { name: "Lửa và Nước 1 – Forest Temple", slug: "lua-va-nuoc-1", gameId: "a55c9cc9c21e4fc683c8c6857f3d0c75", frameWidth: 900, frameHeight: 510, order: 1 },
  { name: "Lửa và Nước 2 – Light Temple", slug: "lua-va-nuoc-2", gameId: "383ad09b92c7446b9113cccc29630517", frameWidth: 900, frameHeight: 510, order: 2 },
  { name: "Lửa và Nước 3 – Ice Temple", slug: "lua-va-nuoc-3", gameId: "f3a6e1ac0a77412289cbac47658b2b68", frameWidth: 900, frameHeight: 510, order: 3 },
  { name: "Lửa và Nước 4 – Crystal Temple", slug: "lua-va-nuoc-4", gameId: "3790681b69584409b7f681a8e400102d", frameWidth: 900, frameHeight: 510, order: 4 },
  { name: "Lửa và Nước 5 – Elements", slug: "lua-va-nuoc-5", gameId: "03f124074b0049f89fdace0cacf8ead5", frameWidth: 900, frameHeight: 600, order: 5 },
  { name: "Lửa và Nước 6 – Fairy Tales", slug: "lua-va-nuoc-6", gameId: "56da8a54fe204845b34ccff750d4a60b", frameWidth: 900, frameHeight: 510, order: 6 },
  // Phần 7: ảnh cover chỉ có đuôi .jpg (không có .jpeg như các phần khác) nên cần override.
  { name: "Lửa và Nước 7 – And Friends", slug: "lua-va-nuoc-7", gameId: "d4a3629101574bc39bd8f9d1888ca58e", frameWidth: 900, frameHeight: 511, order: 7, thumbnail: `${IMG}/d4a3629101574bc39bd8f9d1888ca58e-512x384.jpg` },
];

/** Slugs đã gỡ khỏi hiển thị (seed sẽ set các game này về trạng thái ẩn). */
export const HIDDEN_SLUGS: string[] = [];

export function iframeUrlFor(gameId: string): string {
  return `${GD}/${gameId}/`;
}

/** GameDistribution serves cover art per game id at a stable path. */
export function thumbnailFor(gameId: string): string {
  return `${IMG}/${gameId}-512x384.jpeg`;
}
