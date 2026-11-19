/** Content for the public site. Edit this file to change the hotel's details, rooms and copy. */

export interface Hotel {
  name: string;
  tagline: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  checkInTime: string;
  checkOutTime: string;
}

export interface RoomCategory {
  id: string;
  name: string;
  code: string;
  description: string;
  basePrice: number;
  capacity: number;
  bed: string;
  sizeSqm: number;
  view: string;
  amenities: string[];
  /** One-line pitch shown on the room ad. */
  tagline: string;
  /** Short ribbon on the room ad, e.g. "Most booked". */
  badge: string;
  /** Which animated mountain scene to draw (components/roomScenes.tsx). */
  scene: 'standard' | 'deluxe' | 'premium' | 'suite';
}

export const HOTEL: Hotel = {
  name: 'HOTEL PMS',
  tagline: 'A lakeside courtyard hotel in the hills of Nairavale',
  address: '14 Lake Promenade, Old Cantonment',
  city: 'Nairavale',
  country: 'India',
  phone: '+91 90000 00100',
  email: 'stay@vasantacourt.example',
  checkInTime: '14:00',
  checkOutTime: '11:00',
};

const amenities = {
  base: ['Rain shower', 'Fast Wi-Fi', 'Tea & coffee tray', 'Writing desk', 'Daily breakfast'],
};

export const ROOM_CATEGORIES: RoomCategory[] = [
  {
    id: 'cat-standard',
    name: 'Standard',
    code: 'STD',
    tagline: 'A cosy nook with a valley window',
    badge: 'Best value',
    description: 'A warm, quiet room with hand-block linens, a reading nook and a window onto the pines. Everything you need after a day on the trail.',
    basePrice: 6800,
    capacity: 2,
    bed: 'Queen',
    sizeSqm: 26,
    view: 'Valley',
    amenities: amenities.base,
    scene: 'standard',
  },
  {
    id: 'cat-deluxe',
    name: 'Deluxe',
    code: 'DLX',
    tagline: 'More room, and a balcony among the deodars',
    badge: 'Guest favourite',
    description: 'Space to settle in, a private balcony above the treeline, and a deep window seat for the afternoon light.',
    basePrice: 8900,
    capacity: 3,
    bed: 'King or twin',
    sizeSqm: 34,
    view: 'Deodar forest',
    amenities: [...amenities.base, 'Private balcony', 'Minibar'],
    scene: 'deluxe',
  },
  {
    id: 'cat-premium',
    name: 'Premium',
    code: 'PRM',
    tagline: 'Floor-to-ceiling windows on the ridge',
    badge: 'Best views',
    description: 'Glass from floor to ceiling, a soaking tub that faces the peaks, and a balcony made for slow mountain mornings.',
    basePrice: 12500,
    capacity: 3,
    bed: 'King',
    sizeSqm: 42,
    view: 'Ridge & lake',
    amenities: [...amenities.base, 'Balcony', 'Soaking tub', 'Minibar'],
    scene: 'premium',
  },
  {
    id: 'cat-suite',
    name: 'Suite',
    code: 'STE',
    tagline: 'The whole top of the hill, with a fire lit for you',
    badge: 'Signature',
    description: 'A separate drawing room with restored teak, a fireplace for cold nights, a dressing room and butler service throughout your stay.',
    basePrice: 21000,
    capacity: 4,
    bed: 'King',
    sizeSqm: 68,
    view: 'Panoramic lake & peaks',
    amenities: [...amenities.base, 'Drawing room', 'Fireplace', 'Butler service', 'Evening turndown'],
    scene: 'suite',
  },
];


export const FACTS = [
  { value: '48', label: 'rooms and suites' },
  { value: '1926', label: 'year the court was built' },
  { value: '3', label: 'places to eat and drink' },
  { value: '4.2 acres', label: 'of lakeside gardens' },
];

export type FacilityKey = 'saffron' | 'spa' | 'terrace' | 'reading' | 'boathouse' | 'events';

export const AMENITIES: { key: FacilityKey; kicker: string; title: string; text: string }[] = [
  { key: 'saffron', kicker: 'Dining', title: 'The Saffron Room', text: 'Kumaoni and North Indian cooking in the old durbar hall, open from breakfast to last orders at eleven.' },
  { key: 'spa', kicker: 'Wellness', title: 'Lotus Spa', text: 'Four treatment rooms, a steam bath, and a still pool that looks straight out onto the water.' },
  { key: 'terrace', kicker: 'Evenings', title: 'The Long Terrace', text: 'Evening drinks under string lights, with the hills turning blue across the lake.' },
  { key: 'reading', kicker: 'Quiet', title: 'Reading Room', text: 'Two thousand books, a fireplace in winter, and a tea service that appears without being asked.' },
  { key: 'boathouse', kicker: 'On the water', title: 'Boathouse', text: 'Rowing boats and guided dawn trips, with a picnic hamper from the kitchen if you ask ahead.' },
  { key: 'events', kicker: 'Celebrations', title: 'Weddings & Gatherings', text: 'The jasmine courtyard seats two hundred. Our events team looks after everything else.' },
];

export interface GalleryItem {
  /** Key into the illustration library in components/art.tsx. Used when there is no photo. */
  art?: string;
  /** File under public/images/gallery. Takes precedence over `art`. */
  photo?: string;
  caption: string;
  /** Columns out of 12. */
  span: number;
  /** Optional first column, to centre a short row. */
  start?: number;
  /** Tile height in px on desktop. */
  height: number;
}

export const GALLERY: GalleryItem[] = [
  { photo: 'gallery-1.png', caption: 'Balcony above the snowline', span: 4, height: 300 },
  { photo: 'gallery-2.png', caption: 'Tea with the peaks', span: 4, height: 300 },
  { photo: 'gallery-3.png', caption: 'The terrace at golden hour', span: 4, height: 300 },
  { photo: 'gallery-4.png', caption: 'Breakfast above the clouds', span: 5, start: 3, height: 340 },
  { photo: 'gallery-5.png', caption: 'Snowfall from the veranda', span: 3, height: 340 },
];
