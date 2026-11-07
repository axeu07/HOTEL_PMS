/** Everything the UI may call. Pages never import repositories directly. */
export { activityService, authService, demoService, hotelService } from './core';
export { billingService, type InvoiceView } from './billing';
export { emptyGuest, guestName, guestService, type GuestInput, type GuestMatch } from './guests';
export { publicRegistrationService, registrationService, REGISTER_RATE_LIMIT, type PublicRegistrationHotel, type RegistrationSubmission, type VerifiedDetails } from './registrations';
export { housekeepingService, maintenanceService, ORDER_FLOW, orderTotal, restaurantService, staffService } from './operations';
export { downloadCsv, reportService, type DayRevenue, type ReportData } from './reports';
export { ACTION_CATEGORIES, ACTION_KINDS, deriveQuickActions, matchesFocus, priorityActions, quickActionService, UNTRACKED_ACTIONS, type ActionCategory, type ActionKind, type PriorityCard, type PriorityKey, type QuickAction } from './quickActions';
export { reservationService, type DepartureBill, type ReservationInput } from './reservations';
export { roomService } from './rooms';
export { publicReviewService, RATE_LIMIT, reviewService, type PublicHotel, type ReviewSubmission } from './reviews';
export { communicationService, emptyLead, leadService, publicLeadService, templateService, type LeadInput, type PublicOffer, type TemplateInput } from './crm';
