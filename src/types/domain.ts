/**
 * Domain model. These interfaces are the contract between the UI, the service
 * layer and whatever eventually persists the data. Dates are ISO `YYYY-MM-DD`
 * strings, timestamps are full ISO strings, and money is in whole major units.
 */

export type ID = string;
export type ISODate = string;
export type ISODateTime = string;

export interface Entity {
  id: ID;
}

/* ---------- Hotel & configuration ---------- */

export interface TaxConfig {
  /** Room tariff per night at or below which the lower rate applies. */
  roomThreshold: number;
  roomLowRate: number;
  roomHighRate: number;
  foodRate: number;
  serviceRate: number;
  /** Label printed on invoices, e.g. GST. */
  label: string;
}

export interface Hotel extends Entity {
  name: string;
  tagline: string;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  taxNumber: string;
  checkInTime: string;
  checkOutTime: string;
  currency: CurrencyCode;
  invoicePrefix: string;
  tax: TaxConfig;
  /** Public, unguessable key in the guest review QR. It stands in for the hotel id, which never leaves the product. */
  reviewToken: string;
  /** Public, unguessable key in the guest registration QR. Like the review token, it stands in for the hotel id. */
  registerToken: string;
}

export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AED';

/* ---------- Identity ---------- */

export type RoleId = 'admin' | 'manager' | 'reception' | 'housekeeping';

export type Permission =
  | 'dashboard.revenue'
  | 'quickactions.view'
  | 'reservations.view'
  | 'reservations.manage'
  | 'rooms.view'
  | 'rooms.manage'
  | 'rooms.status'
  | 'frontdesk.use'
  | 'guests.view'
  | 'guests.manage'
  | 'housekeeping.view'
  | 'housekeeping.assign'
  | 'housekeeping.work'
  | 'restaurant.use'
  | 'restaurant.menu'
  | 'billing.use'
  | 'staff.view'
  | 'staff.manage'
  | 'reports.view'
  | 'settings.hotel'
  | 'customers.view'
  | 'customers.manage';

export interface Role extends Entity {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
}

export interface User extends Entity {
  name: string;
  email: string;
  roleId: RoleId;
  staffId: ID | null;
  /** Fictional, published demo password. Never used by a production auth flow. */
  demoPassword: string;
}

export interface Session {
  userId: ID;
  signedInAt: ISODateTime;
}

/* ---------- Rooms ---------- */

export type RoomStatus = 'vacant' | 'occupied' | 'maintenance';
export type CleaningStatus = 'clean' | 'dirty' | 'in_progress';

export interface RoomCategory extends Entity {
  name: string;
  code: string;
  description: string;
  basePrice: number;
  capacity: number;
  bed: string;
  sizeSqm: number;
  view: string;
  amenities: string[];
  /** Key into the illustration library. */
  art: string;
}

export interface Room extends Entity {
  number: string;
  floor: number;
  categoryId: ID;
  status: RoomStatus;
  cleaning: CleaningStatus;
  /** When set, replaces the category base price. */
  priceOverride: number | null;
  notes: string;
}

/* ---------- Guests & reservations ---------- */

export interface GuestPreferences {
  floor: 'no_preference' | 'low' | 'high';
  bed: 'no_preference' | 'king' | 'twin';
  pillow: 'no_preference' | 'soft' | 'firm' | 'hypoallergenic';
  dietary: 'none' | 'vegetarian' | 'vegan' | 'jain' | 'gluten_free';
  notes: string;
}

export interface Guest extends Entity {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  city: string;
  company: string;
  idType: 'passport' | 'national_id' | 'driving_licence' | '';
  idNumber: string;
  vip: boolean;
  /** Optional: older records and website requests do not have one. */
  age?: number;
  /** Optional. Only the day and month matter for birthday offers. */
  birthday?: ISODate;
  preferences: GuestPreferences;
  createdAt: ISODateTime;
}

export type ReservationStatus =
  | 'pending'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'cancelled'
  | 'no_show';

export type BookingSource = 'direct' | 'website' | 'phone' | 'walk_in' | 'agent' | 'corporate' | 'lead_link';

export interface Reservation extends Entity {
  code: string;
  guestId: ID;
  categoryId: ID;
  roomId: ID | null;
  checkIn: ISODate;
  checkOut: ISODate;
  adults: number;
  children: number;
  status: ReservationStatus;
  source: BookingSource;
  ratePerNight: number;
  notes: string;
  cancelReason: string;
  createdAt: ISODateTime;
  checkedInAt: ISODateTime | null;
  checkedOutAt: ISODateTime | null;
}

/* ---------- Guest occasions ---------- */

export type OccasionType = 'birthday' | 'anniversary' | 'celebration' | 'family_vacation' | 'business_trip' | 'other';
export type OccasionSource = 'booking' | 'check_in' | 'profile';

/**
 * Something a guest is marking during a stay. It lives on the guest, so it shows on their profile
 * and in Guest Loyalty, and points at the booking it came from. It is not the guest's own birthday
 * (`Guest.birthday`): a "birthday" occasion can be someone else's, and only counts for that stay.
 */
export interface GuestOccasion extends Entity {
  guestId: ID;
  /** The stay it was raised for. Null when staff add one straight to the profile. */
  reservationId: ID | null;
  type: OccasionType;
  /** The day it is celebrated. Empty when the guest did not say; the stay's arrival date stands in. */
  date: ISODate | '';
  /** Whose birthday or anniversary it is. */
  celebrant: string;
  notes: string;
  source: OccasionSource;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  /** Set when the desk confirmed or corrected it at check-in. */
  verifiedAt: ISODateTime | null;
}

/* ---------- Billing ---------- */

export type ChargeKind = 'room' | 'food' | 'service';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'void';
export type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer';

export interface InvoiceLine extends Entity {
  kind: ChargeKind;
  description: string;
  date: ISODate;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  /** Set when the line was posted from a restaurant order. */
  orderId: ID | null;
}

export interface Invoice extends Entity {
  number: string;
  reservationId: ID;
  guestId: ID;
  status: InvoiceStatus;
  issuedOn: ISODate;
  lines: InvoiceLine[];
}

export interface Payment extends Entity {
  invoiceId: ID;
  amount: number;
  method: PaymentMethod;
  reference: string;
  receivedOn: ISODate;
}

export interface InvoiceTotals {
  roomSubtotal: number;
  foodSubtotal: number;
  serviceSubtotal: number;
  subtotal: number;
  tax: number;
  total: number;
  paid: number;
  balance: number;
}

/* ---------- Operations ---------- */

export type TaskType = 'checkout_clean' | 'stayover' | 'deep_clean' | 'turndown';
export type TaskStatus = 'pending' | 'in_progress' | 'done';
export type Priority = 'low' | 'normal' | 'high';

export interface HousekeepingTask extends Entity {
  roomId: ID;
  type: TaskType;
  date: ISODate;
  time: string;
  assigneeId: ID | null;
  status: TaskStatus;
  priority: Priority;
  notes: string;
  completedAt: ISODateTime | null;
}

export type MaintenanceStatus = 'open' | 'in_progress' | 'resolved';

export interface MaintenanceRequest extends Entity {
  roomId: ID;
  title: string;
  description: string;
  priority: Priority;
  status: MaintenanceStatus;
  reportedBy: string;
  assigneeId: ID | null;
  /** True when logging this request took the room out of service. */
  roomOffline: boolean;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

export type MenuCategory = 'Breakfast' | 'Starters' | 'Mains' | 'Desserts' | 'Beverages';

export interface MenuItem extends Entity {
  name: string;
  category: MenuCategory;
  description: string;
  price: number;
  vegetarian: boolean;
  available: boolean;
}

export type OrderType = 'room_service' | 'dining_room';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'delivered' | 'cancelled';

export interface OrderItem {
  menuItemId: ID;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface RestaurantOrder extends Entity {
  code: string;
  type: OrderType;
  reservationId: ID | null;
  tableLabel: string;
  items: OrderItem[];
  status: OrderStatus;
  notes: string;
  /** Invoice the order was charged to, once posted. */
  postedInvoiceId: ID | null;
  createdAt: ISODateTime;
}

export type Department =
  | 'Management'
  | 'Front Office'
  | 'Housekeeping'
  | 'Food & Beverage'
  | 'Maintenance';

export type Shift = 'Morning' | 'Evening' | 'Night';

export interface Staff extends Entity {
  name: string;
  jobTitle: string;
  department: Department;
  email: string;
  phone: string;
  active: boolean;
  joinedOn: ISODate;
}

export interface DutyAssignment extends Entity {
  staffId: ID;
  date: ISODate;
  shift: Shift;
  area: string;
}

/** Someone arriving for a rostered shift. No record means they have not been seen yet. */
export interface AttendanceRecord extends Entity {
  dutyId: ID;
  clockedInAt: ISODateTime;
  /** When a manager acknowledged a late arrival. */
  reviewedAt: ISODateTime | null;
}

/* ---------- Notifications ---------- */

export type ActivityTone = 'info' | 'success' | 'warning';

export interface ActivityItem extends Entity {
  message: string;
  tone: ActivityTone;
  link: string;
  at: ISODateTime;
  read: boolean;
}

/* ---------- Preferences (per browser, not synced) ---------- */

export interface UserPreferences {
  theme: 'light' | 'dark';
  density: 'comfortable' | 'compact';
  dateFormat: 'dmy' | 'mdy';
}

/* ---------- Guest reviews ---------- */

export type ReviewRating = 1 | 2 | 3 | 4 | 5;

/** Left by a guest through the public QR page. Always belongs to exactly one hotel. */
export interface GuestReview extends Entity {
  hotelId: ID;
  rating: ReviewRating;
  /** Empty when the guest wrote nothing. */
  comment: string;
  /** Empty when the guest chose not to give one. */
  guestName: string;
  roomNumber: string;
  /** Chosen by the guest's browser per form, so a repeated send of the same form is stored once. */
  submissionKey: string;
  createdAt: ISODateTime;
}

/* ---------- Guest QR registration ---------- */

export type RegistrationStatus = 'pending' | 'verified' | 'rejected';

/**
 * Submitted by a guest through the public QR page and checked by the front desk. The ID image is kept
 * here and is only ever read by signed-in staff (see services/registrations.ts); the public page can
 * submit but never read.
 */
export interface QrRegistration extends Entity {
  hotelId: ID;
  name: string;
  phone: string;
  age: number;
  idType: 'passport' | 'national_id' | 'driving_licence';
  /** A downsized JPEG data URL (or, for demo rows, a generated sample card). */
  idDocument: string;
  status: RegistrationStatus;
  submittedAt: ISODateTime;
  /** Chosen by the guest's browser per form, so a repeated send is stored once. */
  submissionKey: string;
  /** Sample rows shipped with the demo, not sent by a real guest. */
  demo?: boolean;
  guestId?: ID;
}

/* ---------- Customers: leads, templates, communication ---------- */

export type LeadSource = 'meta' | 'instagram' | 'ota' | 'website' | 'walk_in' | 'call' | 'manual' | 'other';
export type LeadStatus = 'new' | 'contacted' | 'interested' | 'follow_up' | 'converted' | 'lost';
export type LeadActivityKind = 'created' | 'status' | 'note' | 'whatsapp' | 'email' | 'call' | 'link' | 'link_opened' | 'booking' | 'follow_up';

export interface LeadActivity {
  id: ID;
  at: ISODateTime;
  kind: LeadActivityKind;
  text: string;
  by: string;
}

/** An enquiry that has not (yet) become a booking. Demo data: nothing here is pulled from Meta or any OTA. */
export interface Lead extends Entity {
  name: string;
  phone: string;
  email: string;
  source: LeadSource;
  /** Free text, e.g. the campaign or platform the enquiry came through. */
  sourceDetail: string;
  enquiredAt: ISODateTime;
  checkIn: ISODate | '';
  checkOut: ISODate | '';
  adults: number;
  /** Empty when the enquiry did not name a room type. */
  categoryId: ID | '';
  /** Per night, in whole major units. Zero when unknown. */
  budget: number;
  notes: string;
  status: LeadStatus;
  /** Staff member responsible. Empty when unassigned. */
  assignedTo: ID | '';
  followUpOn: ISODate | '';
  lostReason: string;
  /** Public key in the personalised booking link. Empty until a link is generated. */
  bookingToken: string;
  linkCreatedAt: ISODateTime | null;
  linkOpenedAt: ISODateTime | null;
  /** Set when the lead became a booking, either through its link or by the desk. */
  reservationId: ID | null;
  convertedAt: ISODateTime | null;
  activity: LeadActivity[];
}

export type MessageChannel = 'whatsapp' | 'email';

export interface MessageTemplate extends Entity {
  channel: MessageChannel;
  /** Set on the built-in templates, which can be edited and restored but not deleted. */
  builtInKey: string;
  name: string;
  /** Email only. */
  subject: string;
  body: string;
  updatedAt: ISODateTime;
}

/** A message prepared for a guest or lead. The app hands it to WhatsApp or a mail app; it is not sent from here. */
export interface CommunicationLog extends Entity {
  channel: MessageChannel;
  guestId: ID | null;
  leadId: ID | null;
  recipient: string;
  templateName: string;
  subject: string;
  body: string;
  at: ISODateTime;
  by: string;
  /** Sample rows shipped with the demo. */
  demo?: boolean;
}

/** Every persisted collection, keyed by the name the repositories use. */
export interface DemoDatabase {
  hotels: Hotel[];
  roles: Role[];
  users: User[];
  roomCategories: RoomCategory[];
  rooms: Room[];
  guests: Guest[];
  reservations: Reservation[];
  invoices: Invoice[];
  payments: Payment[];
  housekeepingTasks: HousekeepingTask[];
  maintenanceRequests: MaintenanceRequest[];
  menuItems: MenuItem[];
  restaurantOrders: RestaurantOrder[];
  staff: Staff[];
  duties: DutyAssignment[];
  attendance: AttendanceRecord[];
  activity: ActivityItem[];
  guestReviews: GuestReview[];
  qrRegistrations: QrRegistration[];
  leads: Lead[];
  messageTemplates: MessageTemplate[];
  communications: CommunicationLog[];
  occasions: GuestOccasion[];
}
