import type { Hotel, MenuItem, Permission, Role, RoomCategory, Staff, User } from '@/types/domain';

/** All people, companies and places below are fictional. */

export const HOTEL: Hotel = {
  id: 'hotel-1',
  name: 'HOTEL PMS',
  tagline: 'A lakeside courtyard hotel in the hills of Nairavale',
  address: '14 Lake Promenade, Old Cantonment',
  city: 'Nairavale',
  country: 'India',
  phone: '+91 90000 00100',
  email: 'stay@vasantacourt.example',
  taxNumber: 'DEMO-TAX-0000-VC',
  checkInTime: '14:00',
  checkOutTime: '11:00',
  currency: 'INR',
  invoicePrefix: 'VC',
  reviewToken: 'vc7k2m9qx4hd',
  registerToken: 'vc3p8w5nz6rt',
  tax: {
    label: 'GST',
    roomThreshold: 7500,
    roomLowRate: 5,
    roomHighRate: 18,
    foodRate: 5,
    serviceRate: 18,
  },
};

const ALL: Permission[] = [
  'dashboard.revenue', 'quickactions.view', 'reservations.view', 'reservations.manage', 'rooms.view', 'rooms.manage', 'rooms.status',
  'frontdesk.use', 'guests.view', 'guests.manage', 'housekeeping.view', 'housekeeping.assign', 'housekeeping.work',
  'restaurant.use', 'restaurant.menu', 'billing.use', 'staff.view', 'staff.manage', 'reports.view', 'settings.hotel',
  'customers.view', 'customers.manage',
];

export const ROLES: Role[] = [
  { id: 'admin', name: 'Hotel Administrator', description: 'Full control of the property, including configuration and tax.', permissions: ALL },
  {
    id: 'manager',
    name: 'General Manager',
    description: 'Runs daily operations and sees revenue, reports and staffing.',
    permissions: ALL.filter((p) => p !== 'settings.hotel'),
  },
  {
    id: 'reception',
    name: 'Front Desk',
    description: 'Arrivals, departures, bookings, guest folios and payments.',
    permissions: [
      'reservations.view', 'reservations.manage', 'rooms.view', 'frontdesk.use', 'guests.view', 'guests.manage',
      'housekeeping.view', 'restaurant.use', 'billing.use', 'customers.view', 'customers.manage',
    ],
  },
  {
    id: 'housekeeping',
    name: 'Housekeeping',
    description: 'Cleaning schedule, room status and maintenance reports.',
    permissions: ['rooms.view', 'rooms.status', 'housekeeping.view', 'housekeeping.assign', 'housekeeping.work'],
  },
];

/** Sample logins are published on the landing page by design. They protect nothing. */
export const DEMO_ACCOUNTS: User[] = [
  { id: 'user-admin', name: 'Meera Kapoor', email: 'admin@vasantacourt.example', roleId: 'admin', staffId: 'staff-1', demoPassword: 'demo-admin' },
  { id: 'user-manager', name: 'Arjun Rawat', email: 'manager@vasantacourt.example', roleId: 'manager', staffId: 'staff-2', demoPassword: 'demo-manager' },
  { id: 'user-reception', name: 'Tara Joshi', email: 'frontdesk@vasantacourt.example', roleId: 'reception', staffId: 'staff-3', demoPassword: 'demo-desk' },
  { id: 'user-housekeeping', name: 'Lata Bisht', email: 'housekeeping@vasantacourt.example', roleId: 'housekeeping', staffId: 'staff-7', demoPassword: 'demo-house' },
];

const amenities = {
  base: ['Rain shower', 'Fast Wi-Fi', 'Tea & coffee tray', 'Writing desk', 'Daily breakfast'],
};

export const ROOM_CATEGORIES: RoomCategory[] = [
  {
    id: 'cat-courtyard',
    name: 'Mountain View Suite',
    code: 'CYD',
    description: 'A quiet, sunlit room opening onto the jasmine courtyard, with hand-block linens and a reading nook.',
    basePrice: 6800,
    capacity: 2,
    bed: 'Queen',
    sizeSqm: 26,
    view: 'Courtyard',
    amenities: amenities.base,
    art: 'courtyard',
  },
  {
    id: 'cat-garden',
    name: 'Landour View Suite',
    code: 'GDX',
    description: 'More room to settle in, a private sit-out among the deodars, and a deep window seat for the afternoon.',
    basePrice: 8900,
    capacity: 3,
    bed: 'King or twin',
    sizeSqm: 34,
    view: 'Garden',
    amenities: [...amenities.base, 'Private sit-out', 'Minibar'],
    art: 'garden',
  },
  {
    id: 'cat-lake',
    name: 'Lake Studio',
    code: 'LKS',
    description: 'Floor-to-ceiling windows above the water, a soaking tub, and a balcony made for slow mornings.',
    basePrice: 11500,
    capacity: 3,
    bed: 'King',
    sizeSqm: 40,
    view: 'Lake',
    amenities: [...amenities.base, 'Balcony', 'Soaking tub', 'Minibar'],
    art: 'lake',
  },
  {
    id: 'cat-suite',
    name: 'Heritage Suite',
    code: 'HTS',
    description: 'A separate drawing room with restored teak, a dressing room, and butler service throughout your stay.',
    basePrice: 18500,
    capacity: 4,
    bed: 'King',
    sizeSqm: 68,
    view: 'Lake & courtyard',
    amenities: [...amenities.base, 'Drawing room', 'Butler service', 'Soaking tub', 'Evening turndown'],
    art: 'suite',
  },
  {
    id: 'cat-residence',
    name: 'The Vasanta Residence',
    code: 'RES',
    description: 'The top floor in full: two bedrooms, a private terrace over the lake, and a dining room seating eight.',
    basePrice: 32000,
    capacity: 6,
    bed: 'Two kings',
    sizeSqm: 140,
    view: 'Panoramic lake',
    amenities: [...amenities.base, 'Private terrace', 'Dining room', 'Butler service', 'Airport transfer'],
    art: 'residence',
  },
];

type StaffSeed = Omit<Staff, 'joinedOn'> & { tenureDays: number };

const person = (
  n: number,
  name: string,
  jobTitle: string,
  department: Staff['department'],
  tenureDays: number,
  active = true,
): StaffSeed => ({
  id: `staff-${n}`,
  name,
  jobTitle,
  department,
  email: `${name.split(' ')[0].toLowerCase()}@vasantacourt.example`,
  phone: `+91 90000 ${String(20100 + n * 11)}`,
  active,
  tenureDays,
});

export const STAFF_RECORDS: StaffSeed[] = [
  person(1, 'Meera Kapoor', 'Hotel Administrator', 'Management', 2140),
  person(2, 'Arjun Rawat', 'General Manager', 'Management', 1620),
  person(3, 'Tara Joshi', 'Front Office Supervisor', 'Front Office', 980),
  person(4, 'Kabir Sethi', 'Receptionist', 'Front Office', 410),
  person(5, 'Nisha Thapa', 'Concierge', 'Front Office', 720),
  person(6, 'Dev Malhotra', 'Night Auditor', 'Front Office', 300),
  person(7, 'Lata Bisht', 'Housekeeping Supervisor', 'Housekeeping', 1880),
  person(8, 'Rohan Negi', 'Room Attendant', 'Housekeeping', 560),
  person(9, 'Sunita Rana', 'Room Attendant', 'Housekeeping', 840),
  person(10, 'Imran Qureshi', 'Room Attendant', 'Housekeeping', 230),
  person(11, 'Pooja Dobhal', 'Laundry Lead', 'Housekeeping', 1150),
  person(12, 'Vikram Shah', 'Executive Chef', 'Food & Beverage', 1400),
  person(13, 'Ananya Pillai', 'Restaurant Manager', 'Food & Beverage', 690),
  person(14, 'Farhan Ali', 'Room Service Lead', 'Food & Beverage', 520),
  person(15, 'Grace Lobo', 'Server', 'Food & Beverage', 140),
  person(16, 'Hari Semwal', 'Chief Engineer', 'Maintenance', 2300),
  person(17, 'Jatin Kumar', 'Maintenance Technician', 'Maintenance', 380),
  person(18, 'Ritu Chauhan', 'Receptionist', 'Front Office', 95, false),
];

const dish = (
  id: string,
  name: string,
  category: MenuItem['category'],
  price: number,
  description: string,
  vegetarian = true,
): MenuItem => ({ id: `menu-${id}`, name, category, price, description, vegetarian, available: true });

export const MENU: MenuItem[] = [
  dish('1', 'Masala Omelette', 'Breakfast', 340, 'Green chilli, coriander, buttered toast.', false),
  dish('2', 'Aloo Paratha', 'Breakfast', 320, 'Griddled flatbread, white butter, pickle, curd.'),
  dish('3', 'Lakeside Granola Bowl', 'Breakfast', 380, 'Hill honey, stewed apples, yoghurt.'),
  dish('4', 'Poha with Peanuts', 'Breakfast', 280, 'Flattened rice, curry leaf, lime.'),
  dish('5', 'Trout Amritsari', 'Starters', 720, 'Crisp river trout, ajwain, mint chutney.', false),
  dish('6', 'Hara Bhara Kebab', 'Starters', 460, 'Spinach and pea patties, tamarind glaze.'),
  dish('7', 'Pahadi Chicken Tikka', 'Starters', 640, 'Hill-herb marinade, charred in the tandoor.', false),
  dish('8', 'Roasted Beet Salad', 'Starters', 420, 'Goat cheese, walnuts, orange.'),
  dish('9', 'Kumaoni Mutton Curry', 'Mains', 980, 'Slow-braised, bhang-seed gravy, steamed rice.', false),
  dish('10', 'Dal Vasanta', 'Mains', 560, 'Black lentils simmered overnight, smoked butter.'),
  dish('11', 'Paneer Lababdar', 'Mains', 680, 'Fenugreek-tomato gravy, garlic naan.'),
  dish('12', 'Butter-Poached Trout', 'Mains', 1150, 'Lemon, capers, seasonal greens.', false),
  dish('13', 'Wild Mushroom Risotto', 'Mains', 820, 'Hill mushrooms, parmesan, thyme.'),
  dish('14', 'Gulab Jamun', 'Desserts', 320, 'Warm, with saffron cream.'),
  dish('15', 'Apple & Cardamom Crumble', 'Desserts', 420, 'Orchard apples, vanilla ice cream.'),
  dish('16', 'Dark Chocolate Tart', 'Desserts', 480, 'Sea salt, raspberry.'),
  dish('17', 'Masala Chai Pot', 'Beverages', 180, 'Brewed to order, for two.'),
  dish('18', 'Single-Estate Coffee', 'Beverages', 240, 'Pour-over, medium roast.'),
  dish('19', 'Fresh Lime Soda', 'Beverages', 220, 'Sweet, salted or mixed.'),
  dish('20', 'Rhododendron Cooler', 'Beverages', 280, 'House cordial, soda, mint.'),
];

export const FIRST_NAMES = [
  'Aarav', 'Aditi', 'Aisha', 'Amit', 'Anika', 'Ayaan', 'Bhavna', 'Chitra', 'Daniel', 'Deepa', 'Emma', 'Esha', 'Gaurav', 'Hannah',
  'Harsh', 'Ishaan', 'Isha', 'Jaya', 'Karan', 'Kavya', 'Lucas', 'Maya', 'Mohit', 'Naina', 'Neel', 'Olivia', 'Pranav', 'Priya',
  'Rahul', 'Riya', 'Sahil', 'Sana', 'Shreya', 'Siddharth', 'Tanvi', 'Uma', 'Varun', 'Vidya', 'Yash', 'Zoya',
];

export const LAST_NAMES = [
  'Agarwal', 'Bajaj', 'Banerjee', 'Bose', 'Chandra', 'Das', 'Desai', 'Dutta', 'Fischer', 'Gill', 'Gupta', 'Iyer', 'Jain', 'Khan',
  'Khanna', 'Krishnan', 'Mehta', 'Menon', 'Mishra', 'Nair', 'Patel', 'Rao', 'Reddy', 'Saxena', 'Sen', 'Sharma', 'Singh', 'Tan', 'Varma', 'Wright',
];

export const CITIES = ['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad', 'Jaipur', 'Ahmedabad', 'Lucknow', 'Chandigarh', 'Singapore', 'London', 'Dubai'];

export const COMPANIES = ['Northwind Traders', 'Halden Consulting', 'Bluepeak Systems', 'Marigold Foods', 'Tessera Labs'];
